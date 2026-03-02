/**
 * ════════════════════════════════════════════════════════════
 *  INSIGHTS WORKER — Proactive daily insight delivery
 * ════════════════════════════════════════════════════════════
 *
 *  Polls the Algonit /api/algo/insights endpoint periodically
 *  and sends push notifications with notable analytical findings.
 *
 *  Unlike the alert worker (5-minute cycle for urgent alerts),
 *  this worker runs on a longer cycle (every 6 hours) because
 *  insights are slow-moving analytical data.
 *
 *  Deduplication: Stores a hash of the last insights sent per
 *  tenant in Redis so the same insights aren't sent twice.
 * ════════════════════════════════════════════════════════════
 */

import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { tenants } from '../models/schema.js';
import { AlgonitClient } from '../services/algonit/algonit.client.js';
import { PushService, type PushPayload } from '../services/notifications/push.service.js';
import { logger } from '../utils/logger.js';

const INSIGHTS_HASH_KEY_PREFIX = 'insights_worker:last_hash:';
const INSIGHTS_HASH_TTL = 24 * 60 * 60; // 24 hours in seconds

export class InsightsWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pushService: PushService;

  constructor(pushService?: PushService) {
    this.pushService = pushService || new PushService();
  }

  /**
   * Start the insights worker.
   * Default: every 6 hours (21,600,000 ms)
   */
  start(intervalMs = 6 * 60 * 60 * 1000) {
    logger.info('Insights worker starting...');

    // Run initial check after a 2-minute delay (let alert worker go first)
    setTimeout(() => {
      this.runCheck().catch((err) => logger.error({ err }, 'Initial insights check failed'));
    }, 2 * 60 * 1000);

    this.intervalId = setInterval(() => {
      this.runCheck().catch((err) => logger.error({ err }, 'Insights check failed'));
    }, intervalMs);

    logger.info({ intervalMs }, 'Insights worker started');
  }

  /**
   * Stop the insights worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Insights worker stopped');
    }
  }

  /**
   * Run a single insights check across all active tenants
   */
  async runCheck(): Promise<void> {
    const db = getDb();
    const activeTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.isActive, true));

    logger.debug({ tenantCount: activeTenants.length }, 'Running insights check');

    for (const tenant of activeTenants) {
      try {
        await this.checkTenant(tenant);
      } catch (err) {
        logger.error({ err, tenantId: tenant.id }, 'Failed to check tenant insights');
      }
    }
  }

  /**
   * Check a single tenant for new insights and send push if found
   */
  private async checkTenant(tenant: any): Promise<void> {
    const redis = getRedis();
    const algonit = new AlgonitClient(tenant.id);

    // Calculate date range: last 30 days
    const dateTo = new Date().toISOString().split('T')[0];
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let insightsData;
    try {
      insightsData = await algonit.getInsights(dateFrom, dateTo);
    } catch (err) {
      logger.warn({ err, tenantId: tenant.id }, 'Failed to fetch insights for tenant');
      return;
    }

    if (!insightsData.insights || insightsData.insights.length === 0) {
      return;
    }

    // Deduplication: hash the insights to avoid resending the same ones
    const insightsHash = crypto
      .createHash('md5')
      .update(insightsData.insights.join('|'))
      .digest('hex');

    const hashKey = `${INSIGHTS_HASH_KEY_PREFIX}${tenant.id}`;
    const lastHash = await redis.get(hashKey);

    if (lastHash === insightsHash) {
      logger.debug({ tenantId: tenant.id }, 'Insights unchanged, skipping notification');
      return;
    }

    // Pick the top 1-2 most impactful insights to send as push
    const topInsight = insightsData.insights[0];
    const secondInsight = insightsData.insights.length > 1 ? insightsData.insights[1] : null;

    const body = secondInsight
      ? `${topInsight}\n\nAlso: ${secondInsight}`
      : topInsight;

    const payload: PushPayload = {
      title: 'Algo Insights',
      body,
      type: 'proactive_insight',
      severity: 'low',
      data: {
        period: insightsData.period,
        insight_count: insightsData.insights.length,
        all_insights: insightsData.insights,
      },
      actionUrl: '/insights',
    };

    await this.pushService.sendToTenant(tenant.id, payload);

    // Store hash to prevent resending
    await redis.setex(hashKey, INSIGHTS_HASH_TTL, insightsHash);

    logger.info(
      { tenantId: tenant.id, insightCount: insightsData.insights.length },
      'Proactive insight notification sent',
    );
  }
}

export function startInsightsWorker(): InsightsWorker {
  const pushService = new PushService();
  const worker = new InsightsWorker(pushService);

  // Run every 6 hours
  worker.start(6 * 60 * 60 * 1000);

  logger.info('Insights worker started (6 hour interval)');
  return worker;
}
