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
    const [summary, hotLeads, followUps, engagement, deals, credits, buyingIntent] = await Promise.all([
      algonit.getDashboardSummary(),
      algonit.getHotLeads(),
      algonit.getFollowUps(),
      algonit.getSocialEngagement(),
      algonit.getDeals(),
      algonit.getCreditsBalance(),
      algonit.getBuyingIntent(),
    ]);

    // Build alerts inline so mobile clients get everything in one call
    const alerts: Array<{
      id: string;
      type: string;
      severity: string;
      title: string;
      message: string;
      created_at: string;
    }> = [];
    const now = new Date().toISOString();

    if (credits.balance < 500) {
      alerts.push({
        id: `alert-credit-${Date.now()}`,
        type: 'credit_low',
        severity: 'high',
        title: 'AI Credits Running Low',
        message: `Only ${credits.balance} credits remaining out of ${credits.planCredits + credits.topUpCredits}`,
        created_at: now,
      });
    }

    const overdue = followUps.followUps.filter((c) => c.daysSinceLastContact >= 7);
    if (overdue.length > 0) {
      alerts.push({
        id: `alert-followup-${Date.now()}`,
        type: 'followup_overdue',
        severity: 'medium',
        title: `${overdue.length} Overdue Follow-up${overdue.length > 1 ? 's' : ''}`,
        message: `Highest priority: ${overdue[0].fullName} from ${overdue[0].companyName ?? 'Unknown'} — ${overdue[0].daysSinceLastContact} days since last contact`,
        created_at: now,
      });
    }

    const uncontacted = hotLeads.hotLeads.filter((l) => l.lastEngagementAt === null);
    if (uncontacted.length > 0) {
      alerts.push({
        id: `alert-hotlead-${Date.now()}`,
        type: 'hot_lead',
        severity: 'high',
        title: `${uncontacted.length} Hot Lead(s) Need Attention`,
        message: `${uncontacted[0].fullName} from ${uncontacted[0].companyName ?? 'Unknown'} (score: ${uncontacted[0].leadScore}/100, urgency: ${uncontacted[0].urgency})`,
        created_at: now,
      });
    }

    const highIntent = buyingIntent.signals.filter((s) => s.priority === 'high');
    if (highIntent.length > 0) {
      alerts.push({
        id: `alert-intent-${Date.now()}`,
        type: 'buying_intent',
        severity: 'medium',
        title: `${highIntent.length} High-Priority Buying Signal(s)`,
        message: `${highIntent[0].authorName ?? 'Unknown'} from ${highIntent[0].authorUsername ?? 'Unknown'}: ${highIntent[0].content}`,
        created_at: now,
      });
    }

    return reply.send({
      period: 'current',
      metrics: {
        active_campaigns: summary.campaigns.active,
        total_leads: hotLeads.total,
        hot_leads: hotLeads.hotLeads.length,
        ai_credits_remaining: credits.balance,
        ai_credits_total: credits.planCredits + credits.topUpCredits,
        total_engagement: engagement.overall.totalEngagements,
        revenue_today: deals.deals.reduce((sum, d) => d.stage === 'won' ? sum + d.value : sum, 0),
        pipeline_value: deals.totalPipelineValue,
        pending_followups: overdue.length,
      },
      alerts,
      updated_at: now,
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
