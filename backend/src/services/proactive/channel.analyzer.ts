/**
 * ════════════════════════════════════════════════════════════
 *  CHANNEL ANALYZER — Cross-platform efficiency scoring
 * ════════════════════════════════════════════════════════════
 *
 *  Computes an efficiency score per platform so Algo can
 *  recommend where to focus marketing effort. Scores consider
 *  engagement rate, lead conversion proxy, and cost efficiency.
 * ════════════════════════════════════════════════════════════
 */

import { desc, eq, lte, and } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { kpiSnapshots } from '../../models/schema.js';
import type { AlgonitClient } from '../algonit/algonit.client.js';
import type { ChannelScore, KpiMetrics } from '../../types/proactive.types.js';
import { logger } from '../../utils/logger.js';

// Score weights
const WEIGHT_ENGAGEMENT = 0.4;
const WEIGHT_LEADS = 0.35;
const WEIGHT_COST = 0.25;

export class ChannelAnalyzer {
  constructor(private algonit: AlgonitClient) {}

  /**
   * Compute efficiency scores per platform
   */
  async analyzeChannels(tenantId: string): Promise<ChannelScore[]> {
    const [engagement, campaigns, leads] = await Promise.allSettled([
      this.algonit.getSocialEngagement(),
      this.algonit.listCampaigns(),
      this.algonit.getLeads(),
    ]);

    const scores: ChannelScore[] = [];

    if (engagement.status !== 'fulfilled') {
      logger.warn({ tenantId }, 'Failed to fetch engagement for channel analysis');
      return scores;
    }

    const byPlatform = engagement.value.byPlatform || [];
    const totalLeads = leads.status === 'fulfilled' ? leads.value.total || 1 : 1;
    const leadList = leads.status === 'fulfilled' ? leads.value.leads || [] : [];
    const campaignList = campaigns.status === 'fulfilled' ? campaigns.value.campaigns || [] : [];

    for (const platformData of byPlatform) {
      const platform = platformData.platform;

      // Engagement rate: totalEngagements / impressions (or records if no impressions)
      const impressions = platformData.impressions || platformData.records || 1;
      const engagementRate = (platformData.totalEngagements / impressions) * 100;

      // Lead conversion proxy: leads from this platform's source / total leads
      const platformLeads = leadList.filter(
        (l: any) => l.source?.toLowerCase() === platform.toLowerCase(),
      ).length;
      const leadConversionProxy = (platformLeads / totalLeads) * 100;

      // Cost efficiency: engagement per active campaign on this platform
      const platformCampaigns = campaignList.filter(
        (c: any) => c.platforms?.includes(platform) && c.status === 'active',
      ).length || 1;
      const costEfficiency = platformData.totalEngagements / platformCampaigns;

      // Normalize scores to 0-100
      const normalizedEngagement = Math.min(engagementRate * 10, 100);
      const normalizedLeads = Math.min(leadConversionProxy * 2, 100);
      const normalizedCost = Math.min((costEfficiency / 100) * 10, 100);

      const overallScore = Math.round(
        normalizedEngagement * WEIGHT_ENGAGEMENT +
        normalizedLeads * WEIGHT_LEADS +
        normalizedCost * WEIGHT_COST,
      );

      // Trend: compare with 7d-ago snapshot
      const trend = await this.computeTrend(tenantId, platform);

      const recommendation = this.generateRecommendation(platform, overallScore, engagementRate);

      scores.push({
        platform,
        engagementRate: Math.round(engagementRate * 100) / 100,
        leadConversionProxy: Math.round(leadConversionProxy * 100) / 100,
        costEfficiency: Math.round(costEfficiency * 100) / 100,
        overallScore,
        trend,
        recommendation,
      });
    }

    // Sort by overall score descending
    scores.sort((a, b) => b.overallScore - a.overallScore);

    logger.debug({ tenantId, channelCount: scores.length }, 'Channel analysis complete');
    return scores;
  }

  /**
   * Compare two platforms head-to-head
   */
  async comparePlatforms(
    tenantId: string,
    p1: string,
    p2: string,
  ): Promise<{ scores: ChannelScore[]; winner: string; reasons: string[] }> {
    const allScores = await this.analyzeChannels(tenantId);
    const score1 = allScores.find((s) => s.platform.toLowerCase() === p1.toLowerCase());
    const score2 = allScores.find((s) => s.platform.toLowerCase() === p2.toLowerCase());

    const scores = [score1, score2].filter(Boolean) as ChannelScore[];
    const reasons: string[] = [];

    if (score1 && score2) {
      if (score1.overallScore > score2.overallScore) {
        reasons.push(`${score1.platform} scores ${score1.overallScore} vs ${score2.platform}'s ${score2.overallScore}`);
        if (score1.engagementRate > score2.engagementRate) {
          reasons.push(`Higher engagement rate (${score1.engagementRate}% vs ${score2.engagementRate}%)`);
        }
        if (score1.leadConversionProxy > score2.leadConversionProxy) {
          reasons.push(`Better lead conversion (${score1.leadConversionProxy}% vs ${score2.leadConversionProxy}%)`);
        }
      }
    }

    const winner = scores.length >= 2
      ? scores[0].overallScore >= scores[1].overallScore
        ? scores[0].platform
        : scores[1].platform
      : scores[0]?.platform || 'unknown';

    return { scores, winner, reasons };
  }

  private async computeTrend(tenantId: string, platform: string): Promise<ChannelScore['trend']> {
    // Simplified: check if there's a previous snapshot to compare against
    // A full implementation would track per-platform engagement over time
    try {
      const db = getDb();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [oldSnapshot] = await db
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

      if (!oldSnapshot) return 'stable';

      const oldMetrics = oldSnapshot.metrics as KpiMetrics;
      const db2 = getDb();
      const [latestSnapshot] = await db2
        .select()
        .from(kpiSnapshots)
        .where(eq(kpiSnapshots.tenantId, tenantId))
        .orderBy(desc(kpiSnapshots.capturedAt))
        .limit(1);

      if (!latestSnapshot) return 'stable';

      const currentMetrics = latestSnapshot.metrics as KpiMetrics;
      const change = currentMetrics.totalEngagement - oldMetrics.totalEngagement;
      const pctChange = oldMetrics.totalEngagement > 0
        ? (change / oldMetrics.totalEngagement) * 100
        : 0;

      if (pctChange > 10) return 'improving';
      if (pctChange < -10) return 'declining';
      return 'stable';
    } catch {
      return 'stable';
    }
  }

  private generateRecommendation(platform: string, score: number, engagementRate: number): string | undefined {
    if (score >= 70) {
      return `${platform} is your top performer — consider investing more content here`;
    }
    if (score <= 30) {
      return `${platform} is underperforming — consider pausing low-ROI campaigns or shifting strategy`;
    }
    if (engagementRate < 1) {
      return `${platform} engagement rate is low — try different content formats`;
    }
    return undefined;
  }
}
