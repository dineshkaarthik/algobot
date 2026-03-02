/**
 * ════════════════════════════════════════════════════════════
 *  WEBHOOK VALIDATOR — HMAC-SHA256 signature verification
 * ════════════════════════════════════════════════════════════
 *
 *  Validates incoming Algonit webhook requests:
 *  1. Parse JSON payload
 *  2. Resolve tenant by algonit_org_id
 *  3. Verify HMAC-SHA256 signature (per-tenant webhook secret)
 *  4. Check timestamp freshness (reject > 5 min drift)
 *  5. Redis-based nonce deduplication (10 min window)
 * ════════════════════════════════════════════════════════════
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getRedis } from '../../config/redis.js';
import { getDb } from '../../config/database.js';
import { tenants } from '../../models/schema.js';
import { AlgonitTokenStore } from './algonit.token.store.js';
import { logger } from '../../utils/logger.js';

export interface WebhookPayload {
  event_type: string;               // e.g., 'lead.scored', 'campaign.performance_drop'
  algonit_org_id: string;           // Which Algonit org this event belongs to
  timestamp: string;                // ISO 8601
  nonce: string;                    // Unique event ID for deduplication
  data: Record<string, unknown>;    // Event-specific data
}

export class WebhookValidator {
  private tokenStore: AlgonitTokenStore;

  constructor() {
    this.tokenStore = new AlgonitTokenStore();
  }

  /**
   * Validate a webhook request:
   * 1. Parse the payload
   * 2. Look up tenant by algonit_org_id
   * 3. Verify HMAC-SHA256 signature using per-tenant webhook secret
   * 4. Check timestamp freshness (reject if > 5 minutes old)
   * 5. Check nonce for replay protection (Redis-based, 10 min window)
   */
  async validate(
    rawBody: string,
    signature: string | undefined,
  ): Promise<{ valid: boolean; tenantId?: string; payload?: WebhookPayload; error?: string }> {
    // 1. Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, error: 'Invalid JSON payload' };
    }

    if (!payload.event_type || !payload.algonit_org_id || !payload.timestamp || !payload.nonce) {
      return { valid: false, error: 'Missing required fields' };
    }

    // 2. Look up tenant by algonit_org_id
    const tenantId = await this.findTenantByOrgId(payload.algonit_org_id);
    if (!tenantId) {
      return { valid: false, error: `Unknown Algonit org: ${payload.algonit_org_id}` };
    }

    // 3. Verify signature
    if (!signature) {
      return { valid: false, error: 'Missing X-Algonit-Signature header' };
    }

    const webhookSecret = await this.tokenStore.getWebhookSecret(tenantId);
    if (!webhookSecret) {
      return { valid: false, error: 'No webhook secret configured for tenant' };
    }

    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      logger.warn({ tenantId }, 'Webhook signature mismatch');
      return { valid: false, error: 'Invalid signature' };
    }

    // 4. Check timestamp freshness (max 5 minutes)
    const eventTime = new Date(payload.timestamp).getTime();
    const now = Date.now();
    if (Math.abs(now - eventTime) > 5 * 60 * 1000) {
      return { valid: false, error: 'Event timestamp too old or in the future' };
    }

    // 5. Replay protection — store nonce in Redis with 10 min TTL
    const redis = getRedis();
    const nonceKey = `algonit:webhook:nonce:${payload.nonce}`;
    const wasSet = await redis.set(nonceKey, '1', 'EX', 600, 'NX'); // 10 min TTL, only if not exists
    if (!wasSet) {
      return { valid: false, error: 'Duplicate event (replay detected)' };
    }

    return { valid: true, tenantId, payload };
  }

  /**
   * Resolve a tenant UUID from an Algonit org ID
   */
  private async findTenantByOrgId(algonitOrgId: string): Promise<string | null> {
    const db = getDb();
    const [tenant] = await db.select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.algonitOrgId, algonitOrgId))
      .limit(1);

    return tenant?.id ?? null;
  }
}
