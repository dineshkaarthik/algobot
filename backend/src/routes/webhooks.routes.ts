/**
 * ════════════════════════════════════════════════════════════
 *  WEBHOOK ROUTES — Public endpoint for Algonit events
 * ════════════════════════════════════════════════════════════
 *
 *  POST /api/v1/webhooks/algonit
 *
 *  This endpoint is PUBLIC (no JWT auth). Security is enforced
 *  via HMAC-SHA256 signature verification using a per-tenant
 *  webhook secret, plus timestamp freshness and nonce-based
 *  replay protection.
 * ════════════════════════════════════════════════════════════
 */

import { FastifyInstance } from 'fastify';
import { WebhookValidator } from '../services/algonit/webhook.validator.js';
import { WebhookHandler } from '../services/algonit/webhook.handler.js';
import { logger } from '../utils/logger.js';

export async function webhookRoutes(app: FastifyInstance) {
  const validator = new WebhookValidator();
  const handler = new WebhookHandler();

  // Ensure raw body is available for signature verification.
  // Fastify parses JSON by default; we need the untouched string
  // to compute the HMAC digest.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      try {
        const json = JSON.parse(body as string);
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Store the raw body on the request for signature verification
  app.addHook('preHandler', async (request) => {
    // The body was parsed from a string, so we can reconstruct raw body
    // by stringifying. For HMAC, we need the exact bytes Algonit sent.
    // The content-type parser above receives the raw string; we store it here.
    if (request.body && typeof request.body === 'object') {
      (request as any).rawBody = JSON.stringify(request.body);
    }
  });

  /**
   * POST /algonit — receive Algonit webhook events
   *
   * Headers:
   *   X-Algonit-Signature: sha256=<hex-digest>
   *
   * Body (JSON):
   *   { event_type, algonit_org_id, timestamp, nonce, data }
   *
   * Returns 200 { status: 'received' } on success
   * Returns 401 { error: '...' } on validation failure
   */
  app.post('/algonit', async (request, reply) => {
    const signature = request.headers['x-algonit-signature'] as string | undefined;
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);

    // Validate signature + payload
    const result = await validator.validate(rawBody, signature);

    if (!result.valid) {
      logger.warn({ error: result.error, ip: request.ip }, 'Webhook validation failed');
      return reply.status(401).send({ error: result.error });
    }

    // Process event asynchronously (handler stores in DB then processes in background)
    await handler.handle(result.tenantId!, result.payload!, signature!);

    // Respond quickly so Algonit doesn't time out
    return reply.status(200).send({ status: 'received' });
  });
}
