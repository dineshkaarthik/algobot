/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT TOKEN STORE
 * ════════════════════════════════════════════════════════════
 *
 *  Manages per-tenant Algonit API tokens.
 *  Tokens are stored AES-256-GCM encrypted in PostgreSQL
 *  and cached in Redis (5min TTL).
 *
 *  Algonit API tokens don't expire — they remain valid until
 *  explicitly revoked. No refresh rotation needed.
 * ════════════════════════════════════════════════════════════
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import { algonitConnections } from '../../models/schema.js';
import { AlgonitNotConnectedError } from './algonit.errors.js';
import { logger } from '../../utils/logger.js';
import { getEnv } from '../../config/env.js';

const CACHE_PREFIX = 'algonit:token:';
const CACHE_TTL = 300; // 5 minutes

export class AlgonitTokenStore {
  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = Buffer.from(getEnv().TOKEN_ENCRYPTION_KEY, 'hex'); // 32 bytes
  }

  /**
   * Get the API token for a tenant (cache → DB)
   */
  async getAccessToken(tenantId: string): Promise<string> {
    // 1. Check Redis cache
    const redis = getRedis();
    const cached = await redis.get(`${CACHE_PREFIX}${tenantId}`);
    if (cached) return cached;

    // 2. Check DB
    const db = getDb();
    const [conn] = await db
      .select()
      .from(algonitConnections)
      .where(eq(algonitConnections.tenantId, tenantId))
      .limit(1);

    if (!conn || conn.status !== 'active') {
      throw new AlgonitNotConnectedError('Algonit is not connected for this tenant');
    }

    const apiToken = this.decrypt(conn.accessTokenEnc);

    // Cache for 5 minutes
    await redis.setex(`${CACHE_PREFIX}${tenantId}`, CACHE_TTL, apiToken);
    return apiToken;
  }

  /**
   * Store an API token for a tenant (upsert)
   */
  async storeToken(
    tenantId: string,
    apiToken: string,
    algonitOrgId?: string,
    connectedBy?: string,
  ): Promise<void> {
    const db = getDb();
    const redis = getRedis();

    const values: any = {
      tenantId,
      accessTokenEnc: this.encrypt(apiToken),
      status: 'active',
      updatedAt: new Date(),
    };
    if (algonitOrgId) values.algonitOrgId = algonitOrgId;
    if (connectedBy) values.connectedBy = connectedBy;

    // Upsert
    const [existing] = await db
      .select()
      .from(algonitConnections)
      .where(eq(algonitConnections.tenantId, tenantId))
      .limit(1);

    if (existing) {
      await db.update(algonitConnections).set(values).where(eq(algonitConnections.tenantId, tenantId));
    } else {
      values.connectedAt = new Date();
      await db.insert(algonitConnections).values(values);
    }

    // Cache the token
    await redis.setex(`${CACHE_PREFIX}${tenantId}`, CACHE_TTL, apiToken);
  }

  /**
   * Disconnect tenant — clear token
   */
  async disconnect(tenantId: string): Promise<void> {
    const db = getDb();
    const redis = getRedis();

    await db
      .update(algonitConnections)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(algonitConnections.tenantId, tenantId));

    await redis.del(`${CACHE_PREFIX}${tenantId}`);
  }

  /**
   * Check if a tenant is connected
   */
  async isConnected(tenantId: string): Promise<boolean> {
    try {
      await this.getAccessToken(tenantId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the webhook signing secret for a tenant.
   * Checks Redis cache first, then falls back to the global
   * ALGONIT_WEBHOOK_SECRET env var (shared across tenants).
   */
  async getWebhookSecret(tenantId: string): Promise<string | null> {
    const redis = getRedis();

    // 1. Check per-tenant cache
    const cacheKey = `algonit:webhook_secret:${tenantId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    // 2. Fall back to global env var
    const env = getEnv();
    const secret = env.ALGONIT_WEBHOOK_SECRET ?? null;

    if (secret) {
      // Cache for 5 minutes to avoid repeated env lookups
      await redis.setex(cacheKey, CACHE_TTL, secret);
    }

    return secret;
  }

  // ─── AES-256-GCM Encryption ──────────────────────────────

  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
