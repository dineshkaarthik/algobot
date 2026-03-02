import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService, AuthError } from '../services/auth/auth.service.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  device_id: z.string(),
  device_type: z.enum(['ios', 'android']).optional(),
});

const refreshSchema = z.object({
  refresh_token: z.string(),
});

const registerSchema = z.object({
  tenant_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  algonit_org_id: z.string(),
});

const apiKeySchema = z.object({
  api_key: z.string().min(1),
  device_id: z.string().default('android'),
});

/** Converts camelCase user object to snake_case for mobile clients. */
function formatUser(user: { id: string; email: string; name: string; role: string; tenantId: string; avatarUrl: string | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenantId,
    avatar_url: user.avatarUrl,
  };
}

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService((payload) =>
    app.jwt.sign(payload),
  );

  /**
   * POST /auth/login
   */
  app.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      const result = await authService.login(body.email, body.password, body.device_id);

      return reply.send({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
        token_type: 'Bearer',
        user: formatUser(result.user),
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  /**
   * POST /auth/refresh
   */
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = refreshSchema.parse(request.body);
      const result = await authService.refresh(body.refresh_token);

      return reply.send({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  /**
   * POST /auth/register
   */
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);
      const result = await authService.register(
        body.tenant_name,
        body.email,
        body.password,
        body.name,
        body.algonit_org_id,
      );

      return reply.status(201).send({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
        token_type: 'Bearer',
        user: formatUser(result.user),
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  /**
   * POST /auth/api-key
   * Authenticate with an Algonit API key.
   * Validates the key, auto-creates tenant + user, stores the key encrypted.
   */
  app.post('/api-key', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = apiKeySchema.parse(request.body);
      const result = await authService.loginWithApiKey(body.api_key, body.device_id);

      return reply.send({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
        token_type: 'Bearer',
        user: formatUser(result.user),
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return reply.status(error.statusCode).send({
          error: { code: error.code, message: error.message },
        });
      }
      throw error;
    }
  });

  /**
   * POST /auth/logout (protected)
   */
  app.post('/logout', {
    onRequest: [async (req) => { await req.jwtVerify(); }],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const decoded = request.user as any;
    const body = request.body as { device_id?: string };
    await authService.logout(decoded.sub, body.device_id || 'unknown');
    return reply.send({ status: 'ok' });
  });
}
