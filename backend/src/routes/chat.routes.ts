/**
 * ════════════════════════════════════════════════════════════
 *  CHAT ROUTES — The main conversation interface
 * ════════════════════════════════════════════════════════════
 *
 *  Phase 3 integrations:
 *  - LLMRouter (circuit breaker + Claude→OpenAI fallback)
 *  - MultiIntentParser (compound query splitting)
 *  - FollowupEngine (contextual suggestion generation)
 *  - ConversationSummarizer (title generation + context compression)
 *  - TokenBudgetManager (per-tenant LLM cost enforcement)
 *  - Prometheus metrics tracking
 * ════════════════════════════════════════════════════════════
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AlgoAgent } from '../services/ai/agent.js';
import { LLMRouter } from '../services/llm/llm.router.js';
import { AlgonitClient } from '../services/algonit/algonit.client.js';
import { ContextMemoryService } from '../services/ai/context.memory.js';
import { ConversationService } from '../services/conversation/conversation.service.js';
import { MultiIntentParser } from '../services/ai/multi.intent.js';
import { FollowupEngine } from '../services/ai/followup.engine.js';
import { ConversationSummarizer } from '../services/ai/summarizer.js';
import { TokenBudgetManager } from '../services/llm/token.budget.js';
import { metrics, MetricNames } from '../services/monitoring/metrics.js';
import { logger } from '../utils/logger.js';

// ─── Validation Schemas ──────────────────────────────────

const chatMessageSchema = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(2000),
  input_type: z.enum(['text', 'voice']).default('text'),
  audio_url: z.string().url().optional(),
  context: z
    .object({
      screen: z.string().optional(),
      selected_campaign_id: z.string().optional(),
    })
    .optional(),
});

const confirmSchema = z.object({
  conversation_id: z.string().uuid(),
  confirmation_id: z.string(),
  confirmed: z.boolean(),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ─── Route Registration ──────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  // Initialize services — LLMRouter replaces direct ClaudeProvider
  const llm = new LLMRouter();
  const memory = new ContextMemoryService();
  const conversationService = new ConversationService();
  const multiIntent = new MultiIntentParser(llm);
  const followup = new FollowupEngine();
  const summarizer = new ConversationSummarizer(llm);
  const tokenBudget = new TokenBudgetManager();

  /**
   * POST /chat/message — Send a message to Algo
   */
  app.post('/message', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    let body;
    try {
      body = chatMessageSchema.parse(request.body);
    } catch (error) {
      logger.warn({ err: error, body: request.body }, 'Invalid chat message request');
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request format' },
        timestamp: new Date().toISOString(),
      });
    }

    try {

    const userContext = {
      user_id: request.userId,
      tenant_id: request.tenantId,
      role: request.userRole,
      name: 'User', // TODO: fetch from DB or JWT
    };

    // Create tenant-scoped client and agent
    const algonit = new AlgonitClient(request.tenantId);
    const agent = new AlgoAgent(llm, algonit, memory);

    // ─── Token budget check ───────────────────────────────
    const budget = await tokenBudget.checkBudget(request.tenantId, 'basic'); // TODO: fetch plan from tenant
    if (budget.isExhausted) {
      return reply.status(429).send({
        error: {
          code: 'TOKEN_BUDGET_EXHAUSTED',
          message: `You've reached your hourly AI usage limit. Resets in ${Math.ceil(budget.resetInSeconds / 60)} minutes.`,
          budget: {
            used: budget.used,
            limit: budget.limit,
            reset_in_seconds: budget.resetInSeconds,
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Get or create conversation
    const conversationId = await conversationService.getOrCreateConversation(
      body.conversation_id || null,
      request.userId,
      request.tenantId,
    );

    if (!body.conversation_id) {
      metrics.increment(MetricNames.CONVERSATIONS_CREATED);
    }

    // Save user message
    await conversationService.saveMessage({
      conversationId,
      tenantId: request.tenantId,
      role: 'user',
      content: body.message,
      inputType: body.input_type,
    });

    // ─── Multi-intent detection ───────────────────────────
    const intentResult = await multiIntent.parse(body.message);

    let result;

    if (intentResult.isMultiIntent && intentResult.segments.length > 1) {
      // Process each segment in order (queries first, then actions)
      const responses: string[] = [];
      let lastResult;

      for (const segment of intentResult.executionOrder) {
        lastResult = await agent.process({
          conversationId,
          message: segment.segment,
          inputType: body.input_type,
          userContext,
        });
        responses.push(lastResult.response);
      }

      // Combine results into a unified response
      result = {
        ...lastResult!,
        response: responses.join('\n\n'),
        isMultiIntent: true,
        segmentCount: intentResult.segments.length,
      };
    } else {
      // Single intent — standard processing
      result = await agent.process({
        conversationId,
        message: body.message,
        inputType: body.input_type,
        userContext,
      });
    }

    // ─── Record token usage ───────────────────────────────
    if (result.tokenUsage) {
      await tokenBudget.recordUsage(request.tenantId, {
        inputTokens: result.tokenUsage.input,
        outputTokens: result.tokenUsage.output,
        provider: 'claude', // LLMRouter may use fallback, but we track primary
        model: 'claude-sonnet-4-6',
      });

      metrics.increment(MetricNames.LLM_TOKENS_INPUT, {}, result.tokenUsage.input);
      metrics.increment(MetricNames.LLM_TOKENS_OUTPUT, {}, result.tokenUsage.output);
    }

    // ─── Generate follow-up suggestions ───────────────────
    const currentHour = new Date().getHours();
    const followupSuggestions = followup.suggest({
      lastIntent: result.intent?.classified_as || '',
      userRole: request.userRole,
      currentHour,
      conversationLength: 1, // TODO: track actual length
      recentIntents: [], // TODO: accumulate from context
    });

    // Merge agent suggestions with followup engine suggestions
    const suggestedActions = [
      ...(result.suggestedActions || []),
      ...followupSuggestions,
    ].slice(0, 3); // Max 3 suggestions

    // Save assistant response
    await conversationService.saveMessage({
      conversationId,
      tenantId: request.tenantId,
      role: 'assistant',
      content: result.response,
      structuredData: result.structuredData,
      suggestedActions: suggestedActions as unknown as Array<Record<string, unknown>>,
      intent: result.intent as unknown as Record<string, unknown>,
      reasoningTrace: result.reasoningTrace,
      toolCalls: result.reasoningTrace.tool_calls,
      requiresConfirmation: result.requiresConfirmation,
      confirmationId: result.confirmationId,
      llmProvider: 'claude',
      llmModel: 'claude-sonnet-4-6',
      inputTokens: result.tokenUsage.input,
      outputTokens: result.tokenUsage.output,
    });

    // Auto-generate conversation title using ConversationSummarizer
    if (!body.conversation_id) {
      summarizer.generateTitle(body.message, result.response)
        .then((title) => conversationService.updateTitle(conversationId, title))
        .catch((err) => logger.error({ err }, 'Failed to generate conversation title'));
    }

    // ─── Track metrics ────────────────────────────────────
    metrics.increment(MetricNames.MESSAGES_PROCESSED);
    metrics.increment(MetricNames.AGENT_REQUESTS_TOTAL);
    metrics.observe(MetricNames.AGENT_DURATION, Date.now() - startTime);

    if (result.reasoningTrace?.tool_calls?.length) {
      metrics.increment(
        MetricNames.AGENT_TOOL_CALLS,
        {},
        result.reasoningTrace.tool_calls.length,
      );
    }

    return reply.send({
      conversation_id: conversationId,
      message_id: result.messageId,
      response: {
        text: result.response,
        structured_data: result.structuredData,
        suggested_actions: suggestedActions,
        requires_confirmation: result.requiresConfirmation,
        confirmation_id: result.confirmationId,
      },
      intent: result.intent,
      reasoning_summary: result.reasoningTrace.reflection,
      token_budget: {
        remaining: budget.remaining - (result.tokenUsage?.input || 0) - (result.tokenUsage?.output || 0),
        percent_used: budget.percentUsed,
      },
      timestamp: new Date().toISOString(),
    });

    } catch (error) {
      logger.error({ err: error, tenantId: request.tenantId }, 'Chat message processing failed');
      return reply.status(500).send({
        error: { code: 'PROCESSING_ERROR', message: 'Failed to process your message. Please try again.' },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /chat/confirm — Confirm or cancel a pending action
   */
  app.post('/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = confirmSchema.parse(request.body);

    if (!body.confirmed) {
      metrics.increment(MetricNames.ACTIONS_CANCELLED);
      return reply.send({
        conversation_id: body.conversation_id,
        response: {
          text: "Got it, I've cancelled that action. Anything else I can help with?",
          requires_confirmation: false,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Create tenant-scoped client and agent
    const algonit = new AlgonitClient(request.tenantId);
    const agent = new AlgoAgent(llm, algonit, memory);

    // Re-process with confirmation context
    const result = await agent.process({
      conversationId: body.conversation_id,
      message: `[SYSTEM: User confirmed action ${body.confirmation_id}. Execute the previously described action now.]`,
      inputType: 'text',
      userContext: {
        user_id: request.userId,
        tenant_id: request.tenantId,
        role: request.userRole,
        name: 'User',
      },
    });

    // Record token usage for confirmation
    if (result.tokenUsage) {
      await tokenBudget.recordUsage(request.tenantId, {
        inputTokens: result.tokenUsage.input,
        outputTokens: result.tokenUsage.output,
        provider: 'claude',
        model: 'claude-sonnet-4-6',
      });
    }

    // Save the confirmation result
    await conversationService.saveMessage({
      conversationId: body.conversation_id,
      tenantId: request.tenantId,
      role: 'assistant',
      content: result.response,
      structuredData: result.structuredData,
      suggestedActions: result.suggestedActions as unknown as Array<Record<string, unknown>>,
    });

    metrics.increment(MetricNames.ACTIONS_CONFIRMED);

    return reply.send({
      conversation_id: body.conversation_id,
      message_id: result.messageId,
      response: {
        text: result.response,
        structured_data: result.structuredData,
        suggested_actions: result.suggestedActions,
        requires_confirmation: false,
      },
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /chat/conversations — List user's conversations
   */
  app.get('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);

    const convs = await conversationService.listConversations(
      request.userId,
      request.tenantId,
      query.page,
      query.limit,
    );

    return reply.send({
      conversations: convs.map((c) => ({
        id: c.id,
        title: c.title,
        message_count: c.messageCount,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
      },
    });
  });

  /**
   * GET /chat/conversations/:id/messages — Get conversation messages
   */
  app.get('/conversations/:id/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = paginationSchema.parse(request.query);

    const msgs = await conversationService.getMessages(id, request.tenantId, query.page, query.limit);

    return reply.send({
      messages: msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        input_type: m.inputType,
        structured_data: m.structuredData,
        suggested_actions: m.suggestedActions,
        intent: m.intent,
        timestamp: m.createdAt,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
      },
    });
  });

  /**
   * DELETE /chat/conversations/:id — Archive a conversation
   */
  app.delete('/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await conversationService.archiveConversation(id, request.tenantId);
    return reply.send({ status: 'archived' });
  });

  /**
   * GET /chat/suggestions — Get greeting suggestions for a new conversation
   */
  app.get('/suggestions', async (request: FastifyRequest, reply: FastifyReply) => {
    const currentHour = new Date().getHours();
    const suggestions = followup.greetingSuggestions(request.userRole, currentHour);

    return reply.send({
      suggestions,
      greeting: currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /chat/budget — Get current token budget status
   */
  app.get('/budget', async (request: FastifyRequest, reply: FastifyReply) => {
    const budget = await tokenBudget.checkBudget(request.tenantId, 'basic');
    const stats = await tokenBudget.getUsageStats(request.tenantId);

    return reply.send({
      budget,
      usage: stats,
      timestamp: new Date().toISOString(),
    });
  });
}
