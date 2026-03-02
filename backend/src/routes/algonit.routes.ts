/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT INTEGRATION ROUTES
 * ════════════════════════════════════════════════════════════
 *
 *  Admin-only endpoints for connecting/disconnecting Algonit.
 *  Tenant admin provides their Algonit API token — we verify
 *  it, then store it encrypted for future API calls.
 * ════════════════════════════════════════════════════════════
 */

import { FastifyInstance } from 'fastify';
import { rbac } from '../middleware/rbac.middleware.js';
import { AlgonitAuth } from '../services/algonit/algonit.auth.js';
import { AlgonitTokenStore } from '../services/algonit/algonit.token.store.js';
import { AlgonitCache } from '../services/algonit/algonit.cache.js';
import { logger } from '../utils/logger.js';

export async function algonitRoutes(app: FastifyInstance) {
  const auth = new AlgonitAuth();
  const tokenStore = new AlgonitTokenStore();
  const cache = new AlgonitCache();

  /**
   * POST /connect — Connect Algonit by providing an API token (admin only)
   * Body: { api_token: string }
   */
  app.post('/connect', { preHandler: rbac('admin') }, async (request, reply) => {
    const { api_token } = request.body as { api_token?: string };

    if (!api_token || typeof api_token !== 'string' || api_token.trim().length === 0) {
      return reply.status(400).send({
        error: { code: 'MISSING_TOKEN', message: 'api_token is required' },
      });
    }

    // Verify the token by calling Algonit /me
    const tokenInfo = await auth.verifyToken(api_token.trim());

    // Store the encrypted token
    await tokenStore.storeToken(
      (request as any).tenantId,
      api_token.trim(),
      tokenInfo.algonit_org_id,
      (request as any).userId,
    );

    logger.info({
      tenantId: (request as any).tenantId,
      orgId: tokenInfo.algonit_org_id,
      orgName: tokenInfo.algonit_org_name,
    }, 'Algonit connected');

    return reply.send({
      status: 'connected',
      algonit_org_id: tokenInfo.algonit_org_id,
      algonit_org_name: tokenInfo.algonit_org_name,
    });
  });

  /**
   * DELETE /disconnect — Remove Algonit connection (admin only)
   */
  app.delete('/disconnect', { preHandler: rbac('admin') }, async (request, reply) => {
    const tenantId = (request as any).tenantId;

    await tokenStore.disconnect(tenantId);
    await cache.clearTenant(tenantId);

    logger.info({ tenantId }, 'Algonit disconnected');
    return reply.send({ status: 'disconnected' });
  });

  /**
   * GET /status — Check connection status (any role)
   */
  app.get('/status', async (request, reply) => {
    const connected = await tokenStore.isConnected((request as any).tenantId);
    return reply.send({ connected, status: connected ? 'active' : 'not_connected' });
  });
}
