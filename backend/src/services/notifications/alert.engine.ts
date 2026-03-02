/**
 * ════════════════════════════════════════════════════════════
 *  ALERT ENGINE — Proactive AI-driven alerting
 * ════════════════════════════════════════════════════════════
 *
 *  Background worker that periodically checks business metrics
 *  against configurable thresholds and generates proactive
 *  alerts. This is what makes Algo truly "proactive" —
 *  it doesn't just respond, it anticipates.
 *
 *  Alert types:
 *  - Hot lead detected (uncontacted high-score lead)
 *  - Follow-up overdue (past due date)
 *  - AI credits low (balance below threshold)
 *  - Buying intent detected (high-priority signals)
 *  - Deal close urgency (high-urgency deals needing action)
 * ════════════════════════════════════════════════════════════
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import { tenants } from '../../models/schema.js';
import { AlgonitClient } from '../algonit/algonit.client.js';
import { PushService, type PushPayload } from './push.service.js';
import { logger } from '../../utils/logger.js';

interface AlertRule {
  type: string;
  severity: 'high' | 'medium' | 'low';
  cooldownMinutes: number;
  check: (data: TenantData, thresholds: Record<string, number>) => AlertMatch | null;
}

interface AlertMatch {
  title: string;
  body: string;
  data: Record<string, unknown>;
  actionUrl?: string;
}

interface TenantData {
  hotLeads: any;
  followUps: any;
  credits: any;
  buyingIntent: any;
  deals: any;
}

// ─── Alert Rules ─────────────────────────────────────────

const ALERT_RULES: AlertRule[] = [
  {
    type: 'hot_lead',
    severity: 'high',
    cooldownMinutes: 60,
    check: (data) => {
      const uncontacted = data.hotLeads?.leads?.filter((l: any) => !l.contacted) || [];
      if (uncontacted.length === 0) return null;

      const top = uncontacted[0];
      return {
        title: 'Hot Lead Detected',
        body: `${top.name} from ${top.company} scored ${top.score}/100 (${top.urgency} urgency) and hasn't been contacted yet.`,
        data: { lead_id: top.id, lead_name: top.name, score: top.score, urgency: top.urgency },
        actionUrl: `/leads/${top.id}`,
      };
    },
  },

  {
    type: 'followup_overdue',
    severity: 'high',
    cooldownMinutes: 120,
    check: (data) => {
      const contacts = data.followUps?.contacts || [];
      const overdue = contacts.filter((c: any) => c.days_since_last_contact >= 7);
      if (overdue.length === 0) return null;

      const top = overdue[0];
      return {
        title: `${overdue.length} Follow-up${overdue.length > 1 ? 's' : ''} Overdue`,
        body: `Highest priority: ${top.name} from ${top.company} — ${top.days_since_last_contact} days since last contact via ${top.channel}`,
        data: { overdue_count: overdue.length, top_contact_id: top.id },
        actionUrl: '/crm/follow-ups',
      };
    },
  },

  {
    type: 'credit_low',
    severity: 'medium',
    cooldownMinutes: 360, // 6 hours
    check: (data, thresholds) => {
      const balance = data.credits?.balance ?? Infinity;
      const threshold = thresholds.credit_threshold || 500;
      if (balance > threshold) return null;

      return {
        title: 'AI Credits Running Low',
        body: `Only ${balance} credits remaining out of ${data.credits?.total}. Consider purchasing more credits.`,
        data: {
          balance,
          total: data.credits?.total,
          used: data.credits?.used,
        },
        actionUrl: '/settings/billing',
      };
    },
  },

  {
    type: 'buying_intent',
    severity: 'medium',
    cooldownMinutes: 240, // 4 hours
    check: (data) => {
      const highPriority = data.buyingIntent?.signals?.filter((s: any) => s.priority === 'high') || [];
      if (highPriority.length === 0) return null;

      const top = highPriority[0];
      return {
        title: 'High-Priority Buying Intent',
        body: `${top.contact_name} from ${top.company} is showing strong intent on ${top.platform}: "${top.signal}". Action: ${top.action_needed}`,
        data: { contact_id: top.contact_id, platform: top.platform, priority: top.priority },
        actionUrl: `/leads/${top.contact_id}`,
      };
    },
  },

  {
    type: 'deal_urgency',
    severity: 'medium',
    cooldownMinutes: 360,
    check: (data) => {
      const urgentDeals = data.deals?.deals?.filter((d: any) => d.close_urgency === 'high') || [];
      if (urgentDeals.length === 0) return null;

      const top = urgentDeals[0];
      return {
        title: 'Deal Needs Attention',
        body: `"${top.name}" with ${top.company} ($${top.value.toLocaleString()}) has high close urgency at ${top.stage} stage.`,
        data: { deal_id: top.id, value: top.value, stage: top.stage },
        actionUrl: `/deals/${top.id}`,
      };
    },
  },
];

// ─── Alert Engine ────────────────────────────────────────

export class AlertEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pushService: PushService;

  constructor(pushService?: PushService) {
    this.pushService = pushService || new PushService();
  }

  /**
   * Start the alert engine (runs every 5 minutes)
   */
  start(intervalMs = 5 * 60 * 1000) {
    logger.info('Alert engine starting...');

    // Run immediately on start
    this.runCheck().catch((err) => logger.error({ err }, 'Initial alert check failed'));

    // Then on interval
    this.intervalId = setInterval(() => {
      this.runCheck().catch((err) => logger.error({ err }, 'Alert check failed'));
    }, intervalMs);

    logger.info({ intervalMs }, 'Alert engine started');
  }

  /**
   * Stop the alert engine
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Alert engine stopped');
    }
  }

  /**
   * Run a single alert check across all active tenants
   */
  async runCheck(): Promise<void> {
    const db = getDb();
    const activeTenants = await db
      .select()
      .from(tenants)
      .where(eq(tenants.isActive, true));

    logger.debug({ tenantCount: activeTenants.length }, 'Running alert check');

    for (const tenant of activeTenants) {
      try {
        await this.checkTenant(tenant);
      } catch (err) {
        logger.error({ err, tenantId: tenant.id }, 'Failed to check tenant alerts');
      }
    }
  }

  /**
   * Check a single tenant against all alert rules
   */
  private async checkTenant(tenant: any): Promise<void> {
    const algonit = new AlgonitClient(tenant.id);
    const thresholds = (tenant.alertThresholds as Record<string, number>) || {};

    // Fetch all data in parallel using real Algonit endpoints
    const [hotLeads, followUps, credits, buyingIntent, deals] = await Promise.allSettled([
      algonit.getHotLeads(),
      algonit.getFollowUps(),
      algonit.getCreditsBalance(),
      algonit.getBuyingIntent(),
      algonit.getDeals(),
    ]);

    const data: TenantData = {
      hotLeads: hotLeads.status === 'fulfilled' ? hotLeads.value : null,
      followUps: followUps.status === 'fulfilled' ? followUps.value : null,
      credits: credits.status === 'fulfilled' ? credits.value : null,
      buyingIntent: buyingIntent.status === 'fulfilled' ? buyingIntent.value : null,
      deals: deals.status === 'fulfilled' ? deals.value : null,
    };

    // Check each rule
    for (const rule of ALERT_RULES) {
      const match = rule.check(data, thresholds);
      if (!match) continue;

      // Check cooldown — don't send same alert type too frequently
      const isDuplicate = await this.isInCooldown(tenant.id, rule.type, rule.cooldownMinutes);
      if (isDuplicate) continue;

      // Send alert
      const payload: PushPayload = {
        title: match.title,
        body: match.body,
        type: rule.type,
        severity: rule.severity,
        data: match.data,
        actionUrl: match.actionUrl,
      };

      await this.pushService.sendToTenant(tenant.id, payload);
      await this.markCooldown(tenant.id, rule.type, rule.cooldownMinutes);

      logger.info(
        { tenantId: tenant.id, alertType: rule.type, severity: rule.severity },
        'Alert triggered',
      );
    }
  }

  private async isInCooldown(tenantId: string, alertType: string, cooldownMinutes: number): Promise<boolean> {
    const redis = getRedis();
    const key = `alert_cooldown:${tenantId}:${alertType}`;
    const existing = await redis.get(key);
    return !!existing;
  }

  private async markCooldown(tenantId: string, alertType: string, cooldownMinutes: number): Promise<void> {
    const redis = getRedis();
    const key = `alert_cooldown:${tenantId}:${alertType}`;
    await redis.setex(key, cooldownMinutes * 60, new Date().toISOString());
  }
}
