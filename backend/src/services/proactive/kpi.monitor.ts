/**
 * ════════════════════════════════════════════════════════════
 *  KPI MONITOR — Metric capture & change detection
 * ════════════════════════════════════════════════════════════
 *
 *  Captures periodic KPI snapshots from Algonit data and
 *  detects significant changes over time. This is the
 *  foundation of the Growth Copilot's proactive intelligence.
 *
 *  Flow:
 *  1. captureSnapshot() — polls Algonit endpoints, stores snapshot
 *  2. detectChanges() — compares latest vs 24h/7d ago
 *  3. Returns KpiChange[] with significance ratings
 * ════════════════════════════════════════════════════════════
 */

import { desc, eq, and, lte } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { kpiSnapshots } from '../../models/schema.js';
import type { AlgonitClient } from '../algonit/algonit.client.js';
import type { KpiSnapshot, KpiMetrics, KpiChange } from '../../types/proactive.types.js';
import { logger } from '../../utils/logger.js';

const SIGNIFICANCE_THRESHOLDS = {
  critical: 50,
  high: 25,
  medium: 10,
};

export class KpiMonitor {
  constructor(private algonit: AlgonitClient) {}

  /**
   * Capture current KPIs from multiple Algonit endpoints
   * and store as a snapshot in the database.
   */
  async captureSnapshot(tenantId: string): Promise<KpiSnapshot> {
    const [dashboard, hotLeads, engagement, credits, followUps] = await Promise.allSettled([
      this.algonit.getDashboardSummary(),
      this.algonit.getHotLeads(),
      this.algonit.getSocialEngagement(),
      this.algonit.getCreditsBalance(),
      this.algonit.getFollowUps(),
    ]);

    const metrics: KpiMetrics = {
      totalLeads: 0,
      hotLeads: 0,
      totalEngagement: 0,
      emailOpenRate: 0,
      creditBalance: 0,
      activeCampaigns: 0,
      followupsPending: 0,
      revenue: 0,
    };

    if (dashboard.status === 'fulfilled') {
      const d = dashboard.value;
      metrics.activeCampaigns = d.campaigns?.active ?? 0;
    }

    if (hotLeads.status === 'fulfilled') {
      metrics.hotLeads = hotLeads.value.total ?? 0;
      metrics.totalLeads = hotLeads.value.total ?? 0;
    }

    if (engagement.status === 'fulfilled') {
      metrics.totalEngagement = engagement.value.overall?.totalEngagements ?? 0;
    }

    if (credits.status === 'fulfilled') {
      metrics.creditBalance = credits.value.balance ?? 0;
    }

    if (followUps.status === 'fulfilled') {
      metrics.followupsPending = followUps.value.total ?? 0;
    }

    // Store snapshot in database
    const db = getDb();
    const [record] = await db
      .insert(kpiSnapshots)
      .values({
        tenantId,
        metrics,
      })
      .returning();

    const snapshot: KpiSnapshot = {
      id: record.id,
      tenantId,
      metrics,
      capturedAt: record.capturedAt!,
    };

    logger.debug({ tenantId, metrics }, 'KPI snapshot captured');
    return snapshot;
  }

  /**
   * Compare current snapshot to previous snapshots (24h ago, 7d ago)
   * and return significant changes.
   */
  async detectChanges(tenantId: string): Promise<KpiChange[]> {
    const db = getDb();
    const now = new Date();

    // Get latest snapshot
    const [latest] = await db
      .select()
      .from(kpiSnapshots)
      .where(eq(kpiSnapshots.tenantId, tenantId))
      .orderBy(desc(kpiSnapshots.capturedAt))
      .limit(1);

    if (!latest) return [];

    const currentMetrics = latest.metrics as KpiMetrics;
    const changes: KpiChange[] = [];

    // Compare with 24h ago
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [snapshot24h] = await db
      .select()
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.tenantId, tenantId),
          lte(kpiSnapshots.capturedAt, dayAgo),
        ),
      )
      .orderBy(desc(kpiSnapshots.capturedAt))
      .limit(1);

    if (snapshot24h) {
      const prevMetrics = snapshot24h.metrics as KpiMetrics;
      this.compareMetrics(currentMetrics, prevMetrics, '24h', changes);
    }

    // Compare with 7d ago
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [snapshot7d] = await db
      .select()
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.tenantId, tenantId),
          lte(kpiSnapshots.capturedAt, weekAgo),
        ),
      )
      .orderBy(desc(kpiSnapshots.capturedAt))
      .limit(1);

    if (snapshot7d) {
      const prevMetrics = snapshot7d.metrics as KpiMetrics;
      this.compareMetrics(currentMetrics, prevMetrics, '7d', changes);
    }

    // Only return medium+ significance
    return changes.filter((c) => c.significance !== 'low');
  }

  /**
   * Get trend data for a specific metric over N days
   */
  async getMetricTrend(
    tenantId: string,
    metric: keyof KpiMetrics,
    days: number,
  ): Promise<Array<{ date: string; value: number }>> {
    const db = getDb();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await db
      .select()
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.tenantId, tenantId),
          lte(kpiSnapshots.capturedAt, new Date()),
        ),
      )
      .orderBy(desc(kpiSnapshots.capturedAt))
      .limit(days * 24); // Up to 1 snapshot per hour

    return snapshots
      .filter((s) => s.capturedAt! >= since)
      .map((s) => ({
        date: s.capturedAt!.toISOString().split('T')[0],
        value: (s.metrics as KpiMetrics)[metric] ?? 0,
      }))
      .reverse();
  }

  private compareMetrics(
    current: KpiMetrics,
    previous: KpiMetrics,
    period: string,
    changes: KpiChange[],
  ): void {
    const metricKeys: (keyof KpiMetrics)[] = [
      'totalLeads',
      'hotLeads',
      'totalEngagement',
      'emailOpenRate',
      'creditBalance',
      'activeCampaigns',
      'followupsPending',
      'revenue',
    ];

    for (const key of metricKeys) {
      const currentValue = current[key] ?? 0;
      const previousValue = previous[key] ?? 0;

      if (previousValue === 0 && currentValue === 0) continue;

      const changePercent =
        previousValue === 0
          ? currentValue > 0
            ? 100
            : 0
          : ((currentValue - previousValue) / previousValue) * 100;

      if (Math.abs(changePercent) < 5) continue;

      const absChange = Math.abs(changePercent);
      let significance: KpiChange['significance'] = 'low';
      if (absChange >= SIGNIFICANCE_THRESHOLDS.critical) significance = 'critical';
      else if (absChange >= SIGNIFICANCE_THRESHOLDS.high) significance = 'high';
      else if (absChange >= SIGNIFICANCE_THRESHOLDS.medium) significance = 'medium';

      changes.push({
        metric: key,
        previousValue,
        currentValue,
        changePercent: Math.round(changePercent * 10) / 10,
        direction: currentValue >= previousValue ? 'up' : 'down',
        significance,
        period,
      });
    }
  }
}
