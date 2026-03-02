/**
 * ════════════════════════════════════════════════════════════
 *  WEBHOOK HANDLER — Process Algonit webhook events
 * ════════════════════════════════════════════════════════════
 *
 *  Receives validated webhook payloads, stores them in the
 *  webhook_events table, and triggers notifications/push
 *  alerts to all active users in the tenant.
 *
 *  Supported event types:
 *  - lead.scored        → Hot lead detected
 *  - lead.created       → New lead created
 *  - campaign.performance_drop → Campaign underperforming
 *  - campaign.budget_alert     → Budget threshold reached
 *  - credit.low         → AI credits running low
 *  - task.overdue       → Follow-up task overdue
 * ════════════════════════════════════════════════════════════
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { webhookEvents } from '../../models/schema.js';
import { PushService, type PushPayload } from '../notifications/push.service.js';
import { logger } from '../../utils/logger.js';
import type { WebhookPayload } from './webhook.validator.js';

// Map Algonit webhook events to Algo notification types
const EVENT_TO_NOTIFICATION: Record<string, { type: string; severity: 'high' | 'medium' | 'low'; titleTemplate: string }> = {
  'lead.scored': { type: 'hot_lead', severity: 'high', titleTemplate: 'Hot Lead Detected' },
  'lead.created': { type: 'new_lead', severity: 'medium', titleTemplate: 'New Lead Created' },
  'campaign.performance_drop': { type: 'campaign_drop', severity: 'high', titleTemplate: 'Campaign Performance Drop' },
  'campaign.budget_alert': { type: 'budget_alert', severity: 'high', titleTemplate: 'Campaign Budget Alert' },
  'credit.low': { type: 'credit_low', severity: 'high', titleTemplate: 'AI Credits Running Low' },
  'task.overdue': { type: 'followup_overdue', severity: 'medium', titleTemplate: 'Follow-up Task Overdue' },
};

export class WebhookHandler {
  private pushService: PushService;

  constructor(pushService?: PushService) {
    this.pushService = pushService || new PushService();
  }

  /**
   * Store the event in the database, then process asynchronously.
   * Returns immediately so the webhook response is fast (< 5s).
   */
  async handle(tenantId: string, payload: WebhookPayload, signature: string): Promise<void> {
    const db = getDb();

    // Store event with 'received' status
    const [event] = await db.insert(webhookEvents).values({
      tenantId,
      eventType: payload.event_type,
      payload: payload.data as any,
      signature,
      status: 'received',
    }).returning();

    // Process async — don't block the webhook response
    this.processEvent(event.id, tenantId, payload).catch(err => {
      logger.error({ err, eventId: event.id, tenantId }, 'Webhook event processing failed');
    });
  }

  /**
   * Process a single webhook event: map to notification type,
   * build human-readable body, and push to all tenant users.
   */
  private async processEvent(eventId: string, tenantId: string, payload: WebhookPayload): Promise<void> {
    try {
      const mapping = EVENT_TO_NOTIFICATION[payload.event_type];
      if (!mapping) {
        logger.warn({ eventType: payload.event_type }, 'Unknown webhook event type — storing without notification');
        await this.markEvent(eventId, 'processed');
        return;
      }

      // Build notification body from event-specific data
      const body = this.buildNotificationBody(payload);

      // PushService.sendToTenant handles:
      //   1. Querying all active users in the tenant
      //   2. Inserting notification rows per user
      //   3. Sending WebSocket alerts (real-time)
      //   4. Sending FCM/APNs push notifications
      const pushPayload: PushPayload = {
        title: mapping.titleTemplate,
        body,
        type: mapping.type,
        severity: mapping.severity,
        data: {
          event_type: payload.event_type,
          ...payload.data,
        },
      };

      await this.pushService.sendToTenant(tenantId, pushPayload);

      await this.markEvent(eventId, 'processed');
      logger.info(
        { eventId, eventType: payload.event_type, tenantId },
        'Webhook event processed and notifications sent',
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await this.markEvent(eventId, 'failed', errorMessage);
      throw err;
    }
  }

  /**
   * Update the webhook_events row with final status
   */
  private async markEvent(eventId: string, status: 'processed' | 'failed', error?: string): Promise<void> {
    const db = getDb();
    await db.update(webhookEvents)
      .set({
        status,
        processedAt: new Date(),
        ...(error ? { error } : {}),
      })
      .where(eq(webhookEvents.id, eventId));
  }

  /**
   * Build a human-readable notification body from event data
   */
  private buildNotificationBody(payload: WebhookPayload): string {
    const data = payload.data;
    switch (payload.event_type) {
      case 'lead.scored':
        return `${data.lead_name || 'A lead'} from ${data.company || 'unknown company'} scored ${data.score || 'high'}`;
      case 'lead.created':
        return `New lead: ${data.lead_name || 'Unknown'} from ${data.source || 'unknown source'}`;
      case 'campaign.performance_drop':
        return `Campaign "${data.campaign_name || 'Unknown'}" performance dropped by ${data.drop_pct || '?'}%`;
      case 'campaign.budget_alert':
        return `Campaign "${data.campaign_name || 'Unknown'}" has used ${data.usage_pct || '?'}% of its budget`;
      case 'credit.low':
        return `AI credits running low: ${data.remaining || '?'} credits remaining (${data.usage_pct || '?'}% used)`;
      case 'task.overdue':
        return `Follow-up task for ${data.lead_name || 'unknown lead'} is overdue (was due ${data.due_date || 'recently'})`;
      default:
        return `Event: ${payload.event_type}`;
    }
  }
}
