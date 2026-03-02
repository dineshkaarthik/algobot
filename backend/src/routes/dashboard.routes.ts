import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AlgonitClient } from '../services/algonit/algonit.client.js';

export async function dashboardRoutes(app: FastifyInstance) {
  /**
   * GET /dashboard/summary — Executive dashboard metrics
   * Fetches multiple Algonit APIs in parallel to build a complete snapshot.
   */
  app.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const algonit = new AlgonitClient(request.tenantId);

    // Fetch all data sources in parallel for a comprehensive dashboard
    const [summary, hotLeads, followUps, engagement, deals, credits] = await Promise.all([
      algonit.getDashboardSummary(),
      algonit.getHotLeads(),
      algonit.getFollowUps(),
      algonit.getSocialEngagement(),
      algonit.getDeals(),
      algonit.getCreditsBalance(),
    ]);

    return reply.send({
      period: 'current',
      metrics: {
        active_campaigns: summary.campaigns.active,
        total_leads: hotLeads.total,
        hot_leads: hotLeads.hotLeads.length,
        credits_remaining: credits.balance,
        overdue_follow_ups: followUps.followUps.filter((c) => c.daysSinceLastContact >= 7).length,
        total_engagement: engagement.overall.totalEngagements,
        engagement_trend: 'stable', // TODO: compute trend from historical engagement data
        pipeline_value: deals.totalPipelineValue,
      },
      updated_at: new Date().toISOString(),
    });
  });

  /**
   * GET /dashboard/alerts — Active alerts
   */
  app.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const algonit = new AlgonitClient(request.tenantId);

    // Fetch alert-relevant data in parallel
    const [credits, followUps, hotLeads, buyingIntent] = await Promise.all([
      algonit.getCreditsBalance(),
      algonit.getFollowUps(),
      algonit.getHotLeads(),
      algonit.getBuyingIntent(),
    ]);

    const alerts: Array<{
      type: string;
      severity: string;
      title: string;
      message: string;
    }> = [];

    // Credit alert
    if (credits.balance < 500) {
      alerts.push({
        type: 'credit_low',
        severity: 'high',
        title: 'AI Credits Running Low',
        message: `Only ${credits.balance} credits remaining out of ${credits.planCredits + credits.topUpCredits}`,
      });
    }

    // Overdue follow-ups
    const overdue = followUps.followUps.filter((c) => c.daysSinceLastContact >= 7);
    if (overdue.length > 0) {
      alerts.push({
        type: 'followup_overdue',
        severity: 'medium',
        title: `${overdue.length} Overdue Follow-up${overdue.length > 1 ? 's' : ''}`,
        message: `Highest priority: ${overdue[0].fullName} from ${overdue[0].companyName ?? 'Unknown'} — ${overdue[0].daysSinceLastContact} days since last contact`,
      });
    }

    // Hot leads not recently contacted
    const uncontacted = hotLeads.hotLeads.filter((l) => l.lastEngagementAt === null);
    if (uncontacted.length > 0) {
      alerts.push({
        type: 'hot_lead',
        severity: 'high',
        title: `${uncontacted.length} Hot Lead(s) Need Attention`,
        message: `${uncontacted[0].fullName} from ${uncontacted[0].companyName ?? 'Unknown'} (score: ${uncontacted[0].leadScore}/100, urgency: ${uncontacted[0].urgency})`,
      });
    }

    // High-priority buying intent
    const highIntent = buyingIntent.signals.filter((s) => s.priority === 'high');
    if (highIntent.length > 0) {
      alerts.push({
        type: 'buying_intent',
        severity: 'medium',
        title: `${highIntent.length} High-Priority Buying Signal(s)`,
        message: `${highIntent[0].authorName ?? 'Unknown'} from ${highIntent[0].authorUsername ?? 'Unknown'}: ${highIntent[0].content}`,
      });
    }

    return reply.send({ alerts, updated_at: new Date().toISOString() });
  });
}
