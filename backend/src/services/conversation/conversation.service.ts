/**
 * Conversation & Message persistence service
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../config/database.js';
import { conversations, messages } from '../../models/schema.js';
import type { AgentReasoningTrace, AgentToolCall } from '../../types/chat.types.js';

interface CreateMessageInput {
  conversationId: string;
  tenantId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  inputType?: 'text' | 'voice';
  intent?: Record<string, unknown>;
  entities?: Record<string, unknown>;
  structuredData?: Record<string, unknown>;
  suggestedActions?: Array<Record<string, unknown>>;
  reasoningTrace?: AgentReasoningTrace;
  toolCalls?: AgentToolCall[];
  requiresConfirmation?: boolean;
  confirmationId?: string;
  llmProvider?: string;
  llmModel?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class ConversationService {
  /**
   * Get or create a conversation
   */
  async getOrCreateConversation(
    conversationId: string | null,
    userId: string,
    tenantId: string,
  ): Promise<string> {
    const db = getDb();

    if (conversationId) {
      // Verify the conversation belongs to this user and tenant
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.tenantId, tenantId),
            eq(conversations.userId, userId),
          ),
        )
        .limit(1);

      if (existing) return existing.id;
    }

    // Create new conversation
    const [conv] = await db
      .insert(conversations)
      .values({
        userId,
        tenantId,
        status: 'active',
        messageCount: 0,
      })
      .returning();

    return conv.id;
  }

  /**
   * Save a message to the database
   */
  async saveMessage(input: CreateMessageInput): Promise<string> {
    const db = getDb();

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: input.conversationId,
        tenantId: input.tenantId,
        role: input.role,
        content: input.content,
        inputType: input.inputType,
        intent: input.intent,
        entities: input.entities,
        structuredData: input.structuredData,
        suggestedActions: input.suggestedActions,
        reasoningTrace: input.reasoningTrace,
        toolCalls: input.toolCalls,
        requiresConfirmation: input.requiresConfirmation,
        confirmationId: input.confirmationId,
        llmProvider: input.llmProvider,
        llmModel: input.llmModel,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
      })
      .returning();

    // Update conversation metadata
    await db
      .update(conversations)
      .set({
        messageCount: sql`${conversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversationId));

    return msg.id;
  }

  /**
   * Update conversation title (auto-generated from first message)
   */
  async updateTitle(conversationId: string, title: string): Promise<void> {
    const db = getDb();
    await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  /**
   * List conversations for a user
   */
  async listConversations(userId: string, tenantId: string, page = 1, limit = 20) {
    const db = getDb();
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.tenantId, tenantId),
          eq(conversations.status, 'active'),
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    return result;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, tenantId: string, page = 1, limit = 50) {
    const db = getDb();
    const offset = (page - 1) * limit;

    const result = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.tenantId, tenantId),
        ),
      )
      .orderBy(messages.createdAt)
      .limit(limit)
      .offset(offset);

    return result;
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, tenantId: string): Promise<void> {
    const db = getDb();
    await db
      .update(conversations)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.tenantId, tenantId),
        ),
      );
  }
}
