/**
 * ════════════════════════════════════════════════════════════
 *  CONTEXT MEMORY SERVICE
 * ════════════════════════════════════════════════════════════
 *
 *  Manages multi-turn conversation memory using Redis (hot)
 *  and PostgreSQL (cold). Enables the agent to maintain
 *  context across messages and resolve references like
 *  "it", "that campaign", "the same lead", etc.
 * ════════════════════════════════════════════════════════════
 */

import { getRedis } from '../../config/redis.js';
import { getDb } from '../../config/database.js';
import { eq, and, desc } from 'drizzle-orm';
import { conversations, messages } from '../../models/schema.js';
import type { ConversationContext, ConversationTurn } from '../../types/intent.types.js';
import { logger } from '../../utils/logger.js';

const CONTEXT_TTL = 86400; // 24 hours
const MAX_CONTEXT_TURNS = 20;

interface MemoryUpdateInput {
  userMessage: string;
  assistantResponse: string;
  intent: string;
  entities: Record<string, unknown>;
  timestamp: Date;
}

export class ContextMemoryService {
  /**
   * Get conversation context from Redis (fast) or rebuild from DB
   */
  async getContext(conversationId: string, tenantId: string): Promise<ConversationContext> {
    const redis = getRedis();
    const key = `ctx:${tenantId}:${conversationId}`;

    // Try Redis first
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    // Rebuild from database
    const db = getDb();
    const dbMessages = await db
      .select()
      .from(messages)
      .where(
        and(eq(messages.conversationId, conversationId), eq(messages.tenantId, tenantId)),
      )
      .orderBy(desc(messages.createdAt))
      .limit(MAX_CONTEXT_TURNS * 2);

    const turns: ConversationTurn[] = dbMessages.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      intent: m.intent as any,
      entities: m.entities as any,
      timestamp: m.createdAt!,
    }));

    const context: ConversationContext = {
      conversationId,
      recentTurns: turns,
      entities: this.extractAccumulatedEntities(turns),
    };

    // Cache in Redis
    await redis.setex(key, CONTEXT_TTL, JSON.stringify(context));

    return context;
  }

  /**
   * Update conversation context after a new exchange
   */
  async updateContext(
    conversationId: string,
    tenantId: string,
    input: MemoryUpdateInput,
  ): Promise<void> {
    const redis = getRedis();
    const key = `ctx:${tenantId}:${conversationId}`;

    const context = await this.getContext(conversationId, tenantId);

    // Add user turn
    context.recentTurns.push({
      role: 'user',
      content: input.userMessage,
      entities: input.entities as any,
      timestamp: input.timestamp,
    });

    // Add assistant turn
    context.recentTurns.push({
      role: 'assistant',
      content: input.assistantResponse,
      timestamp: input.timestamp,
    });

    // Trim to max turns
    if (context.recentTurns.length > MAX_CONTEXT_TURNS * 2) {
      context.recentTurns = context.recentTurns.slice(-MAX_CONTEXT_TURNS * 2);
    }

    // Merge entities
    Object.assign(context.entities, input.entities);

    // Update Redis
    await redis.setex(key, CONTEXT_TTL, JSON.stringify(context));
  }

  /**
   * Clear conversation context
   */
  async clearContext(conversationId: string, tenantId: string): Promise<void> {
    const redis = getRedis();
    const key = `ctx:${tenantId}:${conversationId}`;
    await redis.del(key);
  }

  /**
   * Extract accumulated entities from conversation history
   * This helps with reference resolution ("that campaign", "the lead")
   */
  private extractAccumulatedEntities(turns: ConversationTurn[]): Record<string, unknown> {
    const entities: Record<string, unknown> = {};

    for (const turn of turns) {
      if (turn.entities) {
        for (const [key, value] of Object.entries(turn.entities)) {
          if (value !== null && value !== undefined) {
            entities[key] = value;
          }
        }
      }
    }

    return entities;
  }
}
