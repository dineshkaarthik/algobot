/**
 * ════════════════════════════════════════════════════════════
 *  RECOMMENDATIONS ROUTES — Growth Copilot REST API
 * ════════════════════════════════════════════════════════════
 *
 *  REST endpoints for the mobile app to interact with
 *  AI-generated recommendations:
 *
 *  GET  /                — List active recommendations
 *  POST /:id/accept      — Accept and queue for execution
 *  POST /:id/dismiss     — Dismiss a recommendation
 *  GET  /history          — Execution log
 *  GET  /safety           — Safety guardrails status
 * ════════════════════════════════════════════════════════════
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { executionLog } from '../models/schema.js';
import { AlgonitClient } from '../services/algonit/algonit.client.js';
import { RecommendationEngine } from '../services/proactive/recommendation.engine.js';
import { SafetyGuardrails } from '../services/proactive/safety.guardrails.js';
import { logger } from '../utils/logger.js';

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
});

export async function recommendationsRoutes(app: FastifyInstance) {
  /**
   * GET / — List active recommendations
   */
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const algonit = new AlgonitClient(request.tenantId);
    const recEngine = new RecommendationEngine(algonit);

    const recs = await recEngine.getActiveRecommendations(request.tenantId);

    return reply.send({
      recommendations: recs.slice(0, query.limit).map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        confidence: r.confidence,
        impact: r.impact,
        category: r.category,
        actionable: r.actionable,
        action: r.action
          ? { tool: r.action.toolName, params: r.action.params }
          : null,
        status: r.status,
        created_at: r.createdAt,
        expires_at: r.expiresAt,
      })),
      total: recs.length,
    });
  });

  /**
   * POST /:id/accept — Accept a recommendation
   */
  app.post('/:id/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const algonit = new AlgonitClient(request.tenantId);
    const recEngine = new RecommendationEngine(algonit);

    try {
      const confirmationId = await recEngine.acceptRecommendation(
        id,
        request.userId,
        request.tenantId,
      );

      return reply.send({
        confirmation_id: confirmationId,
        status: 'awaiting_confirmation',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept recommendation';
      logger.error({ err, recId: id }, 'Recommendation accept failed');
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * POST /:id/dismiss — Dismiss a recommendation
   */
  app.post('/:id/dismiss', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const algonit = new AlgonitClient(request.tenantId);
    const recEngine = new RecommendationEngine(algonit);

    try {
      await recEngine.dismissRecommendation(id, request.tenantId);
      return reply.send({ status: 'dismissed' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dismiss recommendation';
      logger.error({ err, recId: id }, 'Recommendation dismiss failed');
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * GET /history — Execution log
   */
  app.get('/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const db = getDb();

    const records = await db
      .select()
      .from(executionLog)
      .where(eq(executionLog.tenantId, request.tenantId))
      .orderBy(desc(executionLog.executedAt))
      .limit(query.limit);

    return reply.send({
      executions: records.map((r) => ({
        id: r.id,
        recommendation_id: r.recommendationId,
        action_type: r.actionType,
        before_state: r.beforeState,
        after_state: r.afterState,
        result: r.result,
        error: r.error,
        executed_at: r.executedAt,
      })),
    });
  });

  /**
   * GET /safety — Safety guardrails status
   */
  app.get('/safety', async (request: FastifyRequest, reply: FastifyReply) => {
    const guardrails = new SafetyGuardrails();
    const status = await guardrails.getStatus(request.tenantId);

    return reply.send({
      hourly_used: status.hourlyUsed,
      daily_used: status.dailyUsed,
      limits: {
        max_actions_per_hour: status.limits.maxActionsPerHour,
        max_actions_per_day: status.limits.maxActionsPerDay,
        require_confirmation: status.limits.requireConfirmation,
      },
    });
  });
}
