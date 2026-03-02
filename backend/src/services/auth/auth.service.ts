import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import { getEnv } from '../../config/env.js';
import { users, refreshTokens, tenants } from '../../models/schema.js';
import { AlgonitTokenStore } from '../algonit/algonit.token.store.js';
import { logger } from '../../utils/logger.js';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    avatarUrl: string | null;
  };
}

export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: string;
  deviceId?: string;
}

export class AuthService {
  private jwtSign: (payload: object) => string;

  constructor(jwtSign: (payload: object) => string) {
    this.jwtSign = jwtSign;
  }

  async login(email: string, password: string, deviceId: string): Promise<LoginResult> {
    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    // Generate tokens
    const accessToken = this.generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      deviceId,
    });

    const refreshTokenValue = await this.generateRefreshToken(user.id, deviceId);

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: getEnv().JWT_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async refresh(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const db = getDb();
    const tokenHash = this.hashToken(oldRefreshToken);

    const [tokenRecord] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord) {
      throw new AuthError('Invalid refresh token', 'INVALID_TOKEN', 401);
    }

    // Check if token was already revoked (replay attack detection)
    if (tokenRecord.isRevoked) {
      // Revoke entire token family — potential compromise
      logger.warn({ familyId: tokenRecord.familyId }, 'Refresh token reuse detected! Revoking family.');
      await db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.familyId, tokenRecord.familyId));
      throw new AuthError('Token reuse detected. All sessions revoked.', 'TOKEN_REUSE', 401);
    }

    // Check expiry
    if (new Date() > tokenRecord.expiresAt!) {
      throw new AuthError('Refresh token expired', 'TOKEN_EXPIRED', 401);
    }

    // Revoke old token (rotation)
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, tokenRecord.id));

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new AuthError('User not found or inactive', 'USER_INACTIVE', 401);
    }

    // Issue new pair
    const accessToken = this.generateAccessToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      deviceId: tokenRecord.deviceId || undefined,
    });

    const newRefreshToken = await this.generateRefreshToken(
      user.id,
      tokenRecord.deviceId || undefined,
      tokenRecord.familyId, // Same family for rotation tracking
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: getEnv().JWT_EXPIRES_IN,
    };
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    const db = getDb();

    // Revoke all refresh tokens for this device
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(
        and(eq(refreshTokens.userId, userId), eq(refreshTokens.deviceId, deviceId)),
      );

    // Blacklist current access token in Redis (short TTL matching JWT expiry)
    const redis = getRedis();
    await redis.setex(`revoked:${userId}:${deviceId}`, getEnv().JWT_EXPIRES_IN, '1');
  }

  async register(
    tenantName: string,
    email: string,
    password: string,
    name: string,
    algonitOrgId: string,
  ): Promise<LoginResult> {
    const db = getDb();

    // Check existing
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new AuthError('Email already registered', 'EMAIL_EXISTS', 409);
    }

    // Create tenant
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: tenantName,
        algonitOrgId,
      })
      .returning();

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: 'admin', // First user is admin
      })
      .returning();

    return this.login(email, password, 'registration');
  }

  /**
   * Authenticates using an Algonit API key.
   * Validates the key against Algonit's profile endpoint,
   * auto-creates tenant + user if needed, stores the encrypted API key,
   * and returns JWT tokens.
   */
  async loginWithApiKey(apiKey: string, deviceId: string): Promise<LoginResult> {
    const env = getEnv();
    const db = getDb();

    // 1. Validate the API key by calling Algonit profile endpoint
    let profile: { name: string; email: string; orgId: string; orgName: string };
    try {
      const res = await fetch(`${env.ALGONIT_API_URL}/me`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        throw new AuthError('Invalid API key', 'INVALID_API_KEY', 401);
      }
      const data = await res.json() as any;
      profile = {
        name: data.name || data.fullName || 'Algonit User',
        email: data.email || `user@algonit.local`,
        orgId: String(data.orgId || data.organizationId || data.id || 'default'),
        orgName: data.orgName || data.organizationName || data.companyName || 'My Organization',
      };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logger.error({ error }, 'Failed to validate Algonit API key');
      throw new AuthError('Could not validate API key with Algonit', 'API_KEY_VALIDATION_FAILED', 401);
    }

    // 2. Find or create tenant by algonitOrgId
    let [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.algonitOrgId, profile.orgId))
      .limit(1);

    if (!tenant) {
      [tenant] = await db
        .insert(tenants)
        .values({
          name: profile.orgName,
          algonitOrgId: profile.orgId,
        })
        .returning();
    }

    // 3. Find or create user
    let [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenant.id), eq(users.email, profile.email.toLowerCase())))
      .limit(1);

    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      [user] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: profile.email.toLowerCase(),
          passwordHash,
          name: profile.name,
          role: 'admin',
        })
        .returning();
    }

    // 4. Store the API key encrypted for this tenant
    const tokenStore = new AlgonitTokenStore();
    await tokenStore.storeToken(tenant.id, apiKey, profile.orgId, user.id);

    // 5. Generate JWT tokens
    const accessToken = this.generateAccessToken({
      userId: user.id,
      tenantId: tenant.id,
      role: user.role,
      deviceId,
    });

    const refreshTokenValue = await this.generateRefreshToken(user.id, deviceId);

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: env.JWT_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private generateAccessToken(payload: TokenPayload): string {
    return this.jwtSign({
      sub: payload.userId,
      tid: payload.tenantId,
      role: payload.role,
      did: payload.deviceId,
    });
  }

  private async generateRefreshToken(
    userId: string,
    deviceId?: string,
    familyId?: string,
  ): Promise<string> {
    const db = getDb();
    const env = getEnv();
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);

    await db.insert(refreshTokens).values({
      userId,
      tokenHash,
      familyId: familyId || uuidv4(),
      deviceId: deviceId || null,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN * 1000),
    });

    return token;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AuthError';
  }
}
