/**
 * ════════════════════════════════════════════════════════════
 *  KPI WORKER — Hourly metric capture + recommendation engine
 * ════════════════════════════════════════════════════════════
 *
 *  Runs every hour to:
 *  1. Capture KPI snapshots for trend detection
 *  2. Detect significant KPI changes
 *  3. Generate recommendations when critical changes found
 *  4. Send push notifications for urgent recommendations
 *  5. Expire old pending recommendations
 *
 *  Startup delay: 3 minutes (stagger with alert=0, insights=2min)
 * ════════════════════════════════════════════════════════════
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { tenants } from '../models/schema.js';
import { AlgonitClient } from '../services/algonit/algonit.client.js';
import { KpiMonitor } from '../services/proactive/kpi.monitor.js';
import { RecommendationEngine } from '../services/proactive/recommendation.engine.js';
import { PushService, type PushPayload } from '../services/notifications/push.service.js';
import { logger } from '../utils/logger.js';

export class KpiWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pushService: PushService;

  constructor(pushService?: PushService) {
    this.pushService = pushService || new PushService();
  }

  /**
   * Start the KPI worker.
   * Default: every 1 hour (3,600,000 ms)
   */
  start(intervalMs = 60 * 60 * 1000) {
    logger.info('KPI worker starting...');

    // Run initial check after 3-minute delay (stagger with other workers)
    setTimeout(() => {
      this.runCheck().catch((err) => logger.error({ err }, 'Initial KPI check failed'));
    }, 3 * 60 * 1000);

    this.intervalId = setInterval(() => {
      this.runCheck().catch((err) => logger.error({ err }, 'KPI check failed'));
    }, intervalMs);

    logger.info({ intervalMs }, 'KPI worker started');
  }

  /**
   * Stop the KPI worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('KPI worker stopped');
    }
  }

  /**
   * Run a single check across all active tenants
   */
  async runCheck(): Promise<void> {
    const db = getDb();
    const activeTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.isActive, true));

    logger.debug({ tenantCount: activeTenants.length }, 'Running KPI check');

    for (const tenant of activeTenants) {
      try {
        await this.checkTenant(tenant);
      } catch (err) {
        logger.error({ err, tenantId: tenant.id }, 'Failed KPI check for tenant');
      }
    }
  }

  /**
   * Check a single tenant: capture snapshot, detect changes, generate recommendations
   */
  private async checkTenant(tenant: any): Promise<void> {
    const algonit = new AlgonitClient(tenant.id);
    const kpiMonitor = new KpiMonitor(algonit);
    const recEngine = new RecommendationEngine(algonit, kpiMonitor);

    // 1. Capture KPI snapshot
    await kpiMonitor.captureSnapshot(tenant.id);

    // 2. Detect significant changes
    const changes = await kpiMonitor.detectChanges(tenant.id);
    const criticalOrHigh = changes.filter(
      (c) => c.significance === 'critical' || c.significance === 'high',
    );

    // 3. If significant changes, generate recommendations
    if (criticalOrHigh.length > 0) {
      const newRecs = await recEngine.generateRecommendations(tenant.id);

      // 4. Send push notification with top recommendation
      if (newRecs.length > 0) {
        const topRec = newRecs[0];
        const payload: PushPayload = {
          title: 'Algo Growth Recommendation',
          body: `${topRec.title} (${Math.round(topRec.confidence * 100)}% confidence)`,
          type: 'growth_recommendation',
          severity: topRec.impact === 'high' ? 'high' : 'medium',
          data: {
            recommendation_id: topRec.id,
            type: topRec.type,
            confidence: topRec.confidence,
            actionable: topRec.actionable,
          },
          actionUrl: '/recommendations',
        };

        await this.pushService.sendToTenant(tenant.id, payload);

        logger.info(
          {
            tenantId: tenant.id,
            recommendations: newRecs.length,
            topRec: topRec.title,
          },
          'Growth recommendations generated and pushed',
        );
      }
    }

    // 5. Expire old recommendations
    await recEngine.expireOldRecommendations(tenant.id);
  }
}

export function startKpiWorker(): KpiWorker {
  const pushService = new PushService();
  const worker = new KpiWorker(pushService);

  // Run every 1 hour
  worker.start(60 * 60 * 1000);

  logger.info('KPI worker started (1 hour interval)');
  return worker;
}
