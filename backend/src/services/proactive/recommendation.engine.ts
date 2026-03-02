/**
 * ════════════════════════════════════════════════════════════
 *  RECOMMENDATION ENGINE — AI-powered growth recommendations
 * ════════════════════════════════════════════════════════════
 *
 *  The core brain of the Growth Copilot. Runs a rule engine
 *  against real business data to generate actionable
 *  recommendations with confidence scores.
 *
 *  8 recommendation types:
 *  - pause_underperformer, boost_top_performer
 *  - content_type_shift, lead_followup_urgent
 *  - platform_rebalance, credit_conservation
 *  - engagement_recovery, followup_backlog_clear
 * ════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, gt } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { recommendations, executionLog } from '../../models/schema.js';
import type { AlgonitClient } from '../algonit/algonit.client.js';
import { KpiMonitor } from './kpi.monitor.js';
import { ChannelAnalyzer } from './channel.analyzer.js';
import { ActionExecutor } from '../ai/action.executor.js';
import type {
  Recommendation,
  RecommendationRule,
  RecommendationRuleData,
  KpiChange,
  ChannelScore,
} from '../../types/proactive.types.js';
import { logger } from '../../utils/logger.js';

const RECOMMENDATION_EXPIRY_HOURS = 24;

// ─── Recommendation Rules ────────────────────────────────

const RECOMMENDATION_RULES: RecommendationRule[] = [
  {
    type: 'pause_underperformer',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const campaigns = data.campaigns?.campaigns || [];
      if (campaigns.length < 2) return recs;

      const activeCampaigns = campaigns.filter((c: any) => c.status === 'active');
      if (activeCampaigns.length === 0) return recs;

      const avgPosts = activeCampaigns.reduce((sum: number, c: any) => sum + (c.publishedPosts || 0), 0) / activeCampaigns.length;

      for (const campaign of activeCampaigns) {
        const published = campaign.publishedPosts || 0;
        if (avgPosts > 0 && published < avgPosts * 0.5 && published > 0) {
          const ratio = published / avgPosts;
          recs.push({
            type: 'pause_underperformer',
            title: `Pause underperforming campaign: ${campaign.name}`,
            description: `"${campaign.name}" has only ${published} published posts — ${Math.round((1 - ratio) * 100)}% below average (${Math.round(avgPosts)}). Consider pausing to save resources.`,
            confidence: Math.min(0.6 + (1 - ratio) * 0.3, 0.95),
            impact: 'medium',
            category: 'optimization',
            actionable: true,
            action: {
              toolName: 'pause_campaign',
              params: { campaign_id: String(campaign.id) },
              requiresConfirmation: true as const,
            },
            dataPoints: {
              campaignId: campaign.id,
              campaignName: campaign.name,
              publishedPosts: published,
              avgPosts: Math.round(avgPosts),
              performanceRatio: Math.round(ratio * 100),
            },
          });
        }
      }
      return recs;
    },
  },

  {
    type: 'content_type_shift',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const byContentType = data.insights?.byContentType || [];
      if (byContentType.length < 2) return recs;

      const sorted = [...byContentType].sort((a: any, b: any) => b.avgEngagement - a.avgEngagement);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      if (best && worst && worst.avgEngagement > 0) {
        const ratio = best.avgEngagement / worst.avgEngagement;
        if (ratio >= 2) {
          recs.push({
            type: 'content_type_shift',
            title: `Switch from ${worst.contentType}s to ${best.contentType}s`,
            description: `${best.contentType}s get ${ratio.toFixed(1)}x more engagement than ${worst.contentType}s (${Math.round(best.avgEngagement)} vs ${Math.round(worst.avgEngagement)} average). Consider creating more ${best.contentType} content.`,
            confidence: Math.min(ratio / 5, 0.95),
            impact: 'high',
            category: 'growth',
            actionable: false,
            dataPoints: {
              bestType: best.contentType,
              bestPlatform: best.platform,
              bestAvgEngagement: best.avgEngagement,
              worstType: worst.contentType,
              worstAvgEngagement: worst.avgEngagement,
              ratio: Math.round(ratio * 10) / 10,
            },
          });
        }
      }
      return recs;
    },
  },

  {
    type: 'lead_followup_urgent',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const hotLeads = data.hotLeads?.hotLeads || [];
      const buyingSignals = data.insights?.insights || [];

      // Find hot leads that haven't been contacted recently
      const urgentLeads = hotLeads.filter(
        (l: any) => l.urgency === 'critical' || (l.leadScore >= 80 && !l.lastEngagementAt),
      );

      for (const lead of urgentLeads.slice(0, 3)) {
        recs.push({
          type: 'lead_followup_urgent',
          title: `Follow up with ${lead.fullName || lead.name}`,
          description: `${lead.fullName || lead.name}${lead.companyName ? ` from ${lead.companyName}` : ''} has a lead score of ${lead.leadScore}/100 (${lead.urgency} urgency) and needs immediate attention.`,
          confidence: Math.min(lead.leadScore / 100, 0.95),
          impact: 'high',
          category: 'opportunity',
          actionable: true,
          action: {
            toolName: 'trigger_followup',
            params: { lead_id: String(lead.id) },
            requiresConfirmation: true as const,
          },
          dataPoints: {
            leadId: lead.id,
            leadName: lead.fullName || lead.name,
            company: lead.companyName,
            score: lead.leadScore,
            urgency: lead.urgency,
          },
        });
      }
      return recs;
    },
  },

  {
    type: 'platform_rebalance',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      if (data.channelScores.length < 2) return recs;

      const best = data.channelScores[0]; // Already sorted by score
      const worst = data.channelScores[data.channelScores.length - 1];

      if (best && worst && worst.overallScore > 0 && best.overallScore > worst.overallScore * 1.5) {
        recs.push({
          type: 'platform_rebalance',
          title: `Shift focus from ${worst.platform} to ${best.platform}`,
          description: `${best.platform} (score: ${best.overallScore}/100) is significantly outperforming ${worst.platform} (score: ${worst.overallScore}/100). Consider reallocating content effort.`,
          confidence: Math.min((best.overallScore - worst.overallScore) / 100 + 0.5, 0.9),
          impact: 'medium',
          category: 'optimization',
          actionable: false,
          dataPoints: {
            bestPlatform: best.platform,
            bestScore: best.overallScore,
            worstPlatform: worst.platform,
            worstScore: worst.overallScore,
            scoreDifference: best.overallScore - worst.overallScore,
          },
        });
      }
      return recs;
    },
  },

  {
    type: 'credit_conservation',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const balance = data.credits?.balance;
      if (balance === undefined || balance > 500) return recs;

      const campaigns = data.campaigns?.campaigns || [];
      const activeCampaigns = campaigns.filter((c: any) => c.status === 'active');

      if (activeCampaigns.length > 0 && balance < 200) {
        // Suggest pausing the campaign with lowest engagement
        const lowestCampaign = activeCampaigns.sort(
          (a: any, b: any) => (a.publishedPosts || 0) - (b.publishedPosts || 0),
        )[0];

        recs.push({
          type: 'credit_conservation',
          title: `Credits running low — consider pausing "${lowestCampaign.name}"`,
          description: `Only ${balance} credits remaining. "${lowestCampaign.name}" has the lowest activity (${lowestCampaign.publishedPosts || 0} posts). Pausing it could conserve credits.`,
          confidence: balance < 100 ? 0.9 : 0.7,
          impact: 'high',
          category: 'risk',
          actionable: true,
          action: {
            toolName: 'pause_campaign',
            params: { campaign_id: String(lowestCampaign.id) },
            requiresConfirmation: true as const,
          },
          dataPoints: {
            creditBalance: balance,
            campaignId: lowestCampaign.id,
            campaignName: lowestCampaign.name,
          },
        });
      } else if (balance <= 500) {
        recs.push({
          type: 'credit_conservation',
          title: 'AI credits are running low',
          description: `Only ${balance} credits remaining. Consider topping up or reducing AI-powered content generation.`,
          confidence: 0.85,
          impact: 'medium',
          category: 'risk',
          actionable: false,
          dataPoints: { creditBalance: balance },
        });
      }
      return recs;
    },
  },

  {
    type: 'engagement_recovery',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const engagementDrop = data.kpiChanges.find(
        (c) => c.metric === 'totalEngagement' && c.direction === 'down' && c.changePercent <= -20,
      );

      if (engagementDrop) {
        const bestContentType = data.insights?.byContentType?.[0];
        recs.push({
          type: 'engagement_recovery',
          title: 'Engagement dropped — time to act',
          description: `Total engagement dropped ${Math.abs(engagementDrop.changePercent)}% over ${engagementDrop.period}. ${bestContentType ? `Try creating more ${bestContentType.contentType} content on ${bestContentType.platform} — it's your top performer.` : 'Consider publishing fresh content.'}`,
          confidence: Math.min(Math.abs(engagementDrop.changePercent) / 50 + 0.5, 0.9),
          impact: 'high',
          category: 'risk',
          actionable: !!bestContentType,
          action: bestContentType
            ? {
                toolName: 'generate_content',
                params: {
                  platform: bestContentType.platform,
                  topic: 'engagement recovery',
                },
                requiresConfirmation: true as const,
              }
            : undefined,
          dataPoints: {
            dropPercent: engagementDrop.changePercent,
            period: engagementDrop.period,
            bestContentType: bestContentType?.contentType,
          },
        });
      }
      return recs;
    },
  },

  {
    type: 'followup_backlog_clear',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const followUps = data.followUps?.followUps || [];
      const overdue = followUps.filter((f: any) => f.daysSinceLastContact >= 7);

      if (overdue.length >= 5) {
        recs.push({
          type: 'followup_backlog_clear',
          title: `${overdue.length} overdue follow-ups need attention`,
          description: `You have ${overdue.length} contacts waiting 7+ days for a response. The most urgent: ${overdue[0]?.fullName || overdue[0]?.name} (${overdue[0]?.daysSinceLastContact} days overdue).`,
          confidence: Math.min(0.7 + overdue.length * 0.03, 0.95),
          impact: 'high',
          category: 'risk',
          actionable: true,
          action: {
            toolName: 'trigger_followup',
            params: { lead_id: String(overdue[0]?.id) },
            requiresConfirmation: true as const,
          },
          dataPoints: {
            overdueCount: overdue.length,
            topContactId: overdue[0]?.id,
            topContactName: overdue[0]?.fullName || overdue[0]?.name,
            topContactDays: overdue[0]?.daysSinceLastContact,
          },
        });
      }
      return recs;
    },
  },

  {
    type: 'boost_top_performer',
    check: (data) => {
      const recs: ReturnType<RecommendationRule['check']> = [];
      const campaigns = data.campaigns?.campaigns || [];
      const activeCampaigns = campaigns.filter((c: any) => c.status === 'active');
      if (activeCampaigns.length < 2) return recs;

      const avgPosts = activeCampaigns.reduce((sum: number, c: any) => sum + (c.publishedPosts || 0), 0) / activeCampaigns.length;

      for (const campaign of activeCampaigns) {
        const published = campaign.publishedPosts || 0;
        if (avgPosts > 0 && published > avgPosts * 2) {
          recs.push({
            type: 'boost_top_performer',
            title: `"${campaign.name}" is your star campaign`,
            description: `"${campaign.name}" has ${published} published posts — ${Math.round((published / avgPosts - 1) * 100)}% above average. Consider investing more content or budget here.`,
            confidence: Math.min(0.7 + (published / avgPosts - 1) * 0.15, 0.9),
            impact: 'medium',
            category: 'growth',
            actionable: false,
            dataPoints: {
              campaignId: campaign.id,
              campaignName: campaign.name,
              publishedPosts: published,
              avgPosts: Math.round(avgPosts),
            },
          });
        }
      }
      return recs;
    },
  },
];

// ─── Recommendation Engine ───────────────────────────────

export class RecommendationEngine {
  private kpiMonitor: KpiMonitor;
  private channelAnalyzer: ChannelAnalyzer;

  constructor(
    private algonit: AlgonitClient,
    kpiMonitor?: KpiMonitor,
    channelAnalyzer?: ChannelAnalyzer,
  ) {
    this.kpiMonitor = kpiMonitor || new KpiMonitor(algonit);
    this.channelAnalyzer = channelAnalyzer || new ChannelAnalyzer(algonit);
  }

  /**
   * Generate recommendations for a tenant
   */
  async generateRecommendations(tenantId: string): Promise<Recommendation[]> {
    // Gather all data needed by rules
    const [kpiChanges, channelScores, hotLeads, followUps, campaigns, insights, credits] =
      await Promise.allSettled([
        this.kpiMonitor.detectChanges(tenantId),
        this.channelAnalyzer.analyzeChannels(tenantId),
        this.algonit.getHotLeads(),
        this.algonit.getFollowUps(),
        this.algonit.listCampaigns(),
        this.algonit.getInsights(),
        this.algonit.getCreditsBalance(),
      ]);

    const ruleData: RecommendationRuleData = {
      kpiChanges: kpiChanges.status === 'fulfilled' ? kpiChanges.value : [],
      channelScores: channelScores.status === 'fulfilled' ? channelScores.value : [],
      hotLeads: hotLeads.status === 'fulfilled' ? hotLeads.value : null,
      followUps: followUps.status === 'fulfilled' ? followUps.value : null,
      campaigns: campaigns.status === 'fulfilled' ? campaigns.value : null,
      insights: insights.status === 'fulfilled' ? insights.value : null,
      credits: credits.status === 'fulfilled' ? credits.value : null,
    };

    // Run all rules
    const rawRecs: Array<Omit<Recommendation, 'id' | 'tenantId' | 'status' | 'createdAt' | 'expiresAt'>> = [];
    for (const rule of RECOMMENDATION_RULES) {
      try {
        const results = rule.check(ruleData);
        rawRecs.push(...results);
      } catch (err) {
        logger.warn({ err, ruleType: rule.type }, 'Recommendation rule failed');
      }
    }

    // Sort by confidence × impact weight
    const impactWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    rawRecs.sort(
      (a, b) =>
        b.confidence * (impactWeight[b.impact] || 1) -
        a.confidence * (impactWeight[a.impact] || 1),
    );

    // Deduplicate: don't re-recommend if same type+target exists pending
    const db = getDb();
    const existingPending = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.status, 'pending'),
        ),
      );

    const existingKeys = new Set(
      existingPending.map((r) => `${r.type}:${JSON.stringify((r.dataPoints as any)?.campaignId || (r.dataPoints as any)?.leadId || '')}`),
    );

    const newRecs: Recommendation[] = [];
    const expiresAt = new Date(Date.now() + RECOMMENDATION_EXPIRY_HOURS * 60 * 60 * 1000);

    for (const raw of rawRecs.slice(0, 5)) {
      const dedupeKey = `${raw.type}:${JSON.stringify((raw.dataPoints as any)?.campaignId || (raw.dataPoints as any)?.leadId || '')}`;
      if (existingKeys.has(dedupeKey)) continue;

      const id = `rec_${uuidv4()}`;
      const now = new Date();

      // Store in DB
      await db.insert(recommendations).values({
        id,
        tenantId,
        type: raw.type,
        title: raw.title,
        description: raw.description,
        confidence: raw.confidence,
        impact: raw.impact,
        category: raw.category,
        actionable: raw.actionable,
        action: raw.action || null,
        dataPoints: raw.dataPoints,
        status: 'pending',
        expiresAt,
      });

      newRecs.push({
        id,
        tenantId,
        ...raw,
        status: 'pending',
        createdAt: now,
        expiresAt,
      });

      existingKeys.add(dedupeKey);
    }

    logger.info(
      { tenantId, generated: newRecs.length, rulesChecked: RECOMMENDATION_RULES.length },
      'Recommendations generated',
    );

    return newRecs;
  }

  /**
   * Get active (pending) recommendations for a tenant
   */
  async getActiveRecommendations(tenantId: string): Promise<Recommendation[]> {
    const db = getDb();
    const now = new Date();

    const records = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.status, 'pending'),
          gt(recommendations.expiresAt, now),
        ),
      )
      .orderBy(desc(recommendations.confidence))
      .limit(10);

    return records.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      type: r.type as Recommendation['type'],
      title: r.title,
      description: r.description,
      confidence: r.confidence,
      impact: r.impact as Recommendation['impact'],
      category: r.category as Recommendation['category'],
      actionable: r.actionable ?? false,
      action: r.action as Recommendation['action'],
      dataPoints: (r.dataPoints as Record<string, unknown>) || {},
      status: r.status as Recommendation['status'],
      createdAt: r.createdAt!,
      expiresAt: r.expiresAt,
    }));
  }

  /**
   * Accept a recommendation — create pending action via ActionExecutor
   */
  async acceptRecommendation(
    recId: string,
    userId: string,
    tenantId: string,
  ): Promise<string> {
    const db = getDb();
    const [rec] = await db
      .select()
      .from(recommendations)
      .where(
        and(
          eq(recommendations.id, recId),
          eq(recommendations.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!rec) throw new Error('Recommendation not found');
    if (rec.status !== 'pending') throw new Error(`Recommendation is ${rec.status}, not pending`);
    if (new Date() > rec.expiresAt) throw new Error('Recommendation has expired');

    const action = rec.action as Recommendation['action'];
    if (!action) throw new Error('This recommendation is not actionable');

    // Create pending action via ActionExecutor
    const executor = new ActionExecutor(this.algonit);
    const confirmationId = await executor.createPendingAction({
      conversationId: '00000000-0000-0000-0000-000000000000', // System-generated
      messageId: '00000000-0000-0000-0000-000000000000',
      userId,
      tenantId,
      intent: `recommendation.${rec.type}`,
      actionType: rec.type,
      description: rec.description,
      targetResource: (rec.dataPoints as Record<string, unknown>) || {},
      apiCall: {
        method: 'POST',
        toolName: action.toolName,
        params: action.params,
      },
    });

    // Update recommendation status
    await db
      .update(recommendations)
      .set({ status: 'accepted', resolvedAt: new Date() })
      .where(eq(recommendations.id, recId));

    logger.info({ recId, confirmationId, tenantId }, 'Recommendation accepted');
    return confirmationId;
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(recId: string, tenantId: string): Promise<void> {
    const db = getDb();
    await db
      .update(recommendations)
      .set({ status: 'dismissed', resolvedAt: new Date() })
      .where(
        and(
          eq(recommendations.id, recId),
          eq(recommendations.tenantId, tenantId),
        ),
      );

    logger.info({ recId, tenantId }, 'Recommendation dismissed');
  }

  /**
   * Log an execution result
   */
  async logExecution(
    recId: string,
    userId: string,
    tenantId: string,
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>,
    result: 'success' | 'failed' | 'rolled_back',
    error?: string,
  ): Promise<void> {
    const db = getDb();

    const [rec] = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, recId))
      .limit(1);

    await db.insert(executionLog).values({
      tenantId,
      recommendationId: recId,
      userId,
      actionType: rec?.type || 'unknown',
      beforeState,
      afterState,
      result,
      error,
    });

    if (result === 'success') {
      await db
        .update(recommendations)
        .set({ status: 'executed', resolvedAt: new Date() })
        .where(eq(recommendations.id, recId));
    }

    logger.info({ recId, result, tenantId }, 'Execution logged');
  }

  /**
   * Expire old pending recommendations
   */
  async expireOldRecommendations(tenantId: string): Promise<number> {
    const db = getDb();
    const now = new Date();

    const expired = await db
      .update(recommendations)
      .set({ status: 'expired', resolvedAt: now })
      .where(
        and(
          eq(recommendations.tenantId, tenantId),
          eq(recommendations.status, 'pending'),
        ),
      )
      .returning();

    // Filter to only those actually past expiresAt (the where clause doesn't check it)
    let count = 0;
    for (const r of expired) {
      if (r.expiresAt < now) count++;
    }

    return count;
  }
}
