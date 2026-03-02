/**
 * ════════════════════════════════════════════════════════════
 *  GROWTH SUMMARY SERVICE — Executive summary builder
 * ════════════════════════════════════════════════════════════
 *
 *  Builds a structured executive growth summary combining:
 *  - KPI changes (what moved and by how much)
 *  - Channel efficiency scores (where to focus)
 *  - Top recommendations (what to do)
 *  - Urgent items (what needs immediate attention)
 *
 *  This is what powers the "How are things going?" response.
 * ════════════════════════════════════════════════════════════
 */

import type { AlgonitClient } from '../algonit/algonit.client.js';
import { KpiMonitor } from './kpi.monitor.js';
import { ChannelAnalyzer } from './channel.analyzer.js';
import { RecommendationEngine } from './recommendation.engine.js';
import type { GrowthSummary, KpiChange, Recommendation, ChannelScore } from '../../types/proactive.types.js';
import { logger } from '../../utils/logger.js';

export class GrowthSummaryService {
  private kpiMonitor: KpiMonitor;
  private channelAnalyzer: ChannelAnalyzer;
  private recEngine: RecommendationEngine;

  constructor(
    private algonit: AlgonitClient,
    kpiMonitor?: KpiMonitor,
    channelAnalyzer?: ChannelAnalyzer,
    recEngine?: RecommendationEngine,
  ) {
    this.kpiMonitor = kpiMonitor || new KpiMonitor(algonit);
    this.channelAnalyzer = channelAnalyzer || new ChannelAnalyzer(algonit);
    this.recEngine = recEngine || new RecommendationEngine(algonit, this.kpiMonitor, this.channelAnalyzer);
  }

  /**
   * Build complete executive growth summary
   */
  async buildSummary(tenantId: string, period: string = '7d'): Promise<GrowthSummary> {
    const [kpiChanges, channelScores, activeRecs, followUps] = await Promise.allSettled([
      this.kpiMonitor.detectChanges(tenantId),
      this.channelAnalyzer.analyzeChannels(tenantId),
      this.recEngine.getActiveRecommendations(tenantId),
      this.algonit.getFollowUps(),
    ]);

    const changes = kpiChanges.status === 'fulfilled' ? kpiChanges.value : [];
    const channels = channelScores.status === 'fulfilled' ? channelScores.value : [];
    const recs = activeRecs.status === 'fulfilled' ? activeRecs.value : [];
    const followUpData = followUps.status === 'fulfilled' ? followUps.value : null;

    // Build urgent items
    const urgentItems: string[] = [];

    // Overdue followups
    const overdueFollowups = followUpData?.followUps?.filter(
      (f: any) => f.daysSinceLastContact >= 7,
    ) || [];
    if (overdueFollowups.length > 0) {
      urgentItems.push(
        `${overdueFollowups.length} overdue follow-up${overdueFollowups.length > 1 ? 's' : ''} (${overdueFollowups[0]?.fullName || overdueFollowups[0]?.name}: ${overdueFollowups[0]?.daysSinceLastContact} days)`,
      );
    }

    // Critical KPI drops
    const criticalDrops = changes.filter((c) => c.significance === 'critical' && c.direction === 'down');
    for (const drop of criticalDrops) {
      urgentItems.push(
        `${this.formatMetricName(drop.metric)} dropped ${Math.abs(drop.changePercent)}% (${drop.period})`,
      );
    }

    // High-impact recommendations
    const urgentRecs = recs.filter((r) => r.impact === 'high' && r.confidence >= 0.8);
    for (const rec of urgentRecs.slice(0, 2)) {
      urgentItems.push(rec.title);
    }

    // Build headline
    const headline = this.buildHeadline(changes, recs, channels);

    const summary: GrowthSummary = {
      period,
      headline,
      kpiChanges: changes,
      topRecommendations: recs.slice(0, 5),
      channelScores: channels,
      urgentItems,
    };

    logger.debug(
      {
        tenantId,
        kpiChanges: changes.length,
        recommendations: recs.length,
        channels: channels.length,
        urgentItems: urgentItems.length,
      },
      'Growth summary built',
    );

    return summary;
  }

  private buildHeadline(
    changes: KpiChange[],
    recs: Recommendation[],
    channels: ChannelScore[],
  ): string {
    const parts: string[] = [];

    // Lead with most significant positive change
    const topPositive = changes
      .filter((c) => c.direction === 'up' && c.significance !== 'low')
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];

    if (topPositive) {
      parts.push(
        `${this.formatMetricName(topPositive.metric)} up ${topPositive.changePercent}%`,
      );
    }

    // Mention negative if critical
    const topNegative = changes
      .filter((c) => c.direction === 'down' && c.significance === 'critical')
      .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))[0];

    if (topNegative) {
      parts.push(
        `${this.formatMetricName(topNegative.metric)} down ${Math.abs(topNegative.changePercent)}%`,
      );
    }

    // Mention recommendation count
    const actionableRecs = recs.filter((r) => r.actionable);
    if (actionableRecs.length > 0) {
      parts.push(`${actionableRecs.length} actionable recommendation${actionableRecs.length > 1 ? 's' : ''}`);
    }

    // Top channel
    if (channels.length > 0) {
      parts.push(`${channels[0].platform} leading (${channels[0].overallScore}/100)`);
    }

    if (parts.length === 0) {
      return 'Things are steady — no major changes detected.';
    }

    return parts.join(' · ');
  }

  private formatMetricName(metric: string): string {
    const names: Record<string, string> = {
      totalLeads: 'Leads',
      hotLeads: 'Hot leads',
      totalEngagement: 'Engagement',
      emailOpenRate: 'Email open rate',
      creditBalance: 'Credits',
      activeCampaigns: 'Active campaigns',
      followupsPending: 'Pending follow-ups',
      revenue: 'Revenue',
    };
    return names[metric] || metric;
  }
}
