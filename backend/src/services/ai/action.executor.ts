/**
 * ════════════════════════════════════════════════════════════
 *  ACTION EXECUTOR — Confirmation flow for write operations
 * ════════════════════════════════════════════════════════════
 *
 *  Manages the lifecycle of actions that require user
 *  confirmation before execution:
 *
 *  1. Agent identifies an action intent
 *  2. ActionExecutor creates a pending action with details
 *  3. User sees confirmation prompt
 *  4. User confirms or cancels
 *  5. ActionExecutor executes or discards
 *  6. Expired actions auto-cleanup
 * ════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, lt } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import { pendingActions } from '../../models/schema.js';
import type { AlgonitClient } from '../algonit/algonit.client.js';
import { SafetyGuardrails } from '../proactive/safety.guardrails.js';
import { logger } from '../../utils/logger.js';

const ACTION_EXPIRY_MINUTES = 5;

export interface PendingAction {
  confirmationId: string;
  conversationId: string;
  messageId: string;
  userId: string;
  tenantId: string;
  intent: string;
  actionType: string;
  description: string;
  targetResource: Record<string, unknown>;
  apiCall: {
    method: string;
    toolName: string;
    params: Record<string, unknown>;
  };
  expiresAt: Date;
}

export interface ActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  actionDescription: string;
}

export class ActionExecutor {
  constructor(private algonit: AlgonitClient) {}

  /**
   * Create a pending action that requires user confirmation
   */
  async createPendingAction(
    action: Omit<PendingAction, 'confirmationId' | 'expiresAt'>,
  ): Promise<string> {
    const db = getDb();
    const confirmationId = `cfm_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + ACTION_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(pendingActions).values({
      conversationId: action.conversationId,
      messageId: action.messageId,
      tenantId: action.tenantId,
      userId: action.userId,
      confirmationId,
      intent: action.intent,
      actionType: action.actionType,
      targetResource: action.targetResource,
      apiCall: action.apiCall,
      status: 'pending',
      expiresAt,
    });

    // Also cache in Redis for fast lookup
    const redis = getRedis();
    await redis.setex(
      `pending_action:${confirmationId}`,
      ACTION_EXPIRY_MINUTES * 60,
      JSON.stringify({
        ...action,
        confirmationId,
        expiresAt: expiresAt.toISOString(),
      }),
    );

    logger.info(
      { confirmationId, intent: action.intent, actionType: action.actionType },
      'Pending action created',
    );

    return confirmationId;
  }

  /**
   * Execute a confirmed action
   */
  async executeAction(confirmationId: string, userId: string, tenantId: string): Promise<ActionResult> {
    // Load from Redis first, fall back to DB
    const redis = getRedis();
    let actionData: PendingAction | null = null;

    const cached = await redis.get(`pending_action:${confirmationId}`);
    if (cached) {
      actionData = JSON.parse(cached);
    } else {
      // Load from DB
      const db = getDb();
      const [record] = await db
        .select()
        .from(pendingActions)
        .where(
          and(
            eq(pendingActions.confirmationId, confirmationId),
            eq(pendingActions.userId, userId),
            eq(pendingActions.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (record) {
        actionData = {
          confirmationId: record.confirmationId,
          conversationId: record.conversationId,
          messageId: record.messageId,
          userId: record.userId,
          tenantId: record.tenantId,
          intent: record.intent,
          actionType: record.actionType,
          description: '',
          targetResource: record.targetResource as Record<string, unknown>,
          apiCall: record.apiCall as PendingAction['apiCall'],
          expiresAt: record.expiresAt,
        };
      }
    }

    if (!actionData) {
      return {
        success: false,
        error: 'Action not found or already expired. Please try the request again.',
        actionDescription: 'Unknown action',
      };
    }

    // Check expiry
    if (new Date() > new Date(actionData.expiresAt)) {
      await this.markAction(confirmationId, 'expired');
      return {
        success: false,
        error: 'This action has expired. Please make the request again for a fresh confirmation.',
        actionDescription: actionData.actionType,
      };
    }

    // Verify ownership
    if (actionData.userId !== userId || actionData.tenantId !== tenantId) {
      return {
        success: false,
        error: 'You are not authorized to execute this action.',
        actionDescription: actionData.actionType,
      };
    }

    // Safety guardrails check
    const guardrails = new SafetyGuardrails();
    const safetyCheck = await guardrails.canExecute(tenantId, actionData.actionType);
    if (!safetyCheck.allowed) {
      logger.warn(
        { confirmationId, actionType: actionData.actionType, reason: safetyCheck.reason },
        'Action blocked by safety guardrails',
      );
      return {
        success: false,
        error: `Safety limit reached: ${safetyCheck.reason}`,
        actionDescription: actionData.actionType,
      };
    }

    // Execute the actual API call
    try {
      const result = await this.callAlgonitApi(actionData.apiCall);

      await this.markAction(confirmationId, 'confirmed');
      await redis.del(`pending_action:${confirmationId}`);
      await guardrails.recordExecution(tenantId);

      logger.info(
        { confirmationId, actionType: actionData.actionType },
        'Action executed successfully',
      );

      return {
        success: true,
        data: result,
        actionDescription: actionData.actionType,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err, confirmationId }, 'Action execution failed');

      return {
        success: false,
        error: `Failed to execute action: ${errorMsg}`,
        actionDescription: actionData.actionType,
      };
    }
  }

  /**
   * Cancel a pending action
   */
  async cancelAction(confirmationId: string, userId: string, tenantId: string): Promise<void> {
    await this.markAction(confirmationId, 'cancelled');
    const redis = getRedis();
    await redis.del(`pending_action:${confirmationId}`);

    logger.info({ confirmationId }, 'Action cancelled');
  }

  /**
   * Cleanup expired actions (called by background worker)
   */
  async cleanupExpired(): Promise<number> {
    const db = getDb();
    const now = new Date();

    const expired = await db
      .update(pendingActions)
      .set({ status: 'expired', resolvedAt: now })
      .where(
        and(eq(pendingActions.status, 'pending'), lt(pendingActions.expiresAt, now)),
      )
      .returning();

    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Cleaned up expired pending actions');
    }

    return expired.length;
  }

  /**
   * Route an API call to the correct Algonit method
   */
  private async callAlgonitApi(
    apiCall: PendingAction['apiCall'],
  ): Promise<Record<string, unknown>> {
    const { toolName, params } = apiCall;

    switch (toolName) {
      case 'pause_campaign':
        return this.algonit.pauseCampaign(params.campaign_id as string) as unknown as Record<string, unknown>;
      case 'resume_campaign':
        return this.algonit.resumeCampaign(params.campaign_id as string) as unknown as Record<string, unknown>;
      case 'create_campaign':
        return this.algonit.createCampaign(params) as unknown as Record<string, unknown>;
      case 'generate_content':
        return this.algonit.generateContent(
          params.platform as string,
          params.topic as string,
          params.tone as string | undefined,
        ) as unknown as Record<string, unknown>;
      case 'trigger_followup':
        return this.algonit.triggerFollowup(
          params.lead_id as string,
          params.method as string | undefined,
        ) as unknown as Record<string, unknown>;
      case 'assign_task':
        return this.algonit.assignTask(
          params.assignee_id as string,
          params.task_type as string,
          params.description as string,
          params.lead_id as string | undefined,
        ) as unknown as Record<string, unknown>;
      case 'generate_report':
        return this.algonit.generateReport(
          params.report_type as string,
          params.date_from as string,
          params.date_to as string,
        ) as unknown as Record<string, unknown>;
      default:
        throw new Error(`Unknown action tool: ${toolName}`);
    }
  }

  /**
   * Update pending action status in DB
   */
  private async markAction(confirmationId: string, status: string): Promise<void> {
    const db = getDb();
    await db
      .update(pendingActions)
      .set({ status, resolvedAt: new Date() })
      .where(eq(pendingActions.confirmationId, confirmationId));
  }
}
