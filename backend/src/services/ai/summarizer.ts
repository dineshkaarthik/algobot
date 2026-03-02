/**
 * ════════════════════════════════════════════════════════════
 *  CONVERSATION SUMMARIZER
 * ════════════════════════════════════════════════════════════
 *
 *  Handles:
 *  1. Auto-generating conversation titles
 *  2. Summarizing long conversations for context compression
 *  3. End-of-day executive briefing generation
 *  4. Intelligent conversation tagging
 * ════════════════════════════════════════════════════════════
 */

import type { LLMProvider } from '../llm/llm.provider.js';
import type { ConversationTurn } from '../../types/intent.types.js';
import { logger } from '../../utils/logger.js';

export class ConversationSummarizer {
  constructor(private llm: LLMProvider) {}

  /**
   * Generate a short title for a conversation (max 6 words)
   */
  async generateTitle(userMessage: string, assistantResponse: string): Promise<string> {
    try {
      const result = await this.llm.complete(
        'Generate a short conversation title (max 6 words). Return ONLY the title, nothing else. No quotes.',
        `User: ${userMessage}\nAssistant: ${assistantResponse.substring(0, 300)}`,
        30,
      );
      return result.trim().replace(/^["']|["']$/g, '').substring(0, 60);
    } catch {
      // Fallback: use first few words of user message
      return userMessage.split(/\s+/).slice(0, 5).join(' ');
    }
  }

  /**
   * Summarize a conversation's history for context compression.
   * Used when the conversation exceeds the context window limit.
   * Instead of dropping old messages, we summarize them.
   */
  async summarizeHistory(turns: ConversationTurn[]): Promise<string> {
    if (turns.length < 6) {
      // Too short to summarize
      return '';
    }

    const conversationText = turns
      .map((t) => `${t.role === 'user' ? 'User' : 'Algo'}: ${t.content}`)
      .join('\n');

    try {
      const summary = await this.llm.complete(
        `You are a conversation summarizer. Create a concise summary that preserves:
1. Key topics discussed
2. Important data points mentioned (numbers, names, dates)
3. Any actions taken or pending
4. User's preferences or patterns noticed

Keep the summary under 200 words. Write in third person ("The user asked about...").`,
        `Summarize this conversation:\n\n${conversationText}`,
        300,
      );
      return summary.trim();
    } catch (err) {
      logger.error({ err }, 'Failed to summarize conversation');
      return '';
    }
  }

  /**
   * Generate an end-of-day executive briefing from the day's interactions
   */
  async generateDailyBriefing(
    conversations: Array<{ title: string; turns: ConversationTurn[]; intents: string[] }>,
  ): Promise<string> {
    if (conversations.length === 0) {
      return "No interactions today. Your dashboard is ready when you need it.";
    }

    const summaries = conversations.map((c) => {
      const topIntents = [...new Set(c.intents)].slice(0, 3).join(', ');
      return `- "${c.title}" (${c.turns.length} messages, topics: ${topIntents})`;
    }).join('\n');

    try {
      const briefing = await this.llm.complete(
        `You are Algo, generating an end-of-day executive briefing. Be concise, warm, and data-driven. Highlight key actions taken and important metrics discussed. Under 150 words.`,
        `Today's interactions:\n${summaries}\n\nGenerate a brief end-of-day summary.`,
        250,
      );
      return briefing.trim();
    } catch {
      return `You had ${conversations.length} conversation(s) today. Check your dashboard for the latest metrics.`;
    }
  }

  /**
   * Auto-tag a conversation based on its content
   */
  async tagConversation(turns: ConversationTurn[]): Promise<string[]> {
    const topics = new Set<string>();

    for (const turn of turns) {
      if (turn.intent) {
        const domain = turn.intent.domain;
        if (domain) topics.add(domain);
      }
    }

    // Map domains to user-friendly tags
    const tagMap: Record<string, string> = {
      social: 'Social Media',
      campaign: 'Campaigns',
      leads: 'Leads',
      email: 'Email',
      credits: 'Credits',
      revenue: 'Revenue',
      analytics: 'Analytics',
      content: 'Content',
      followup: 'Follow-ups',
      task: 'Tasks',
      report: 'Reports',
    };

    return Array.from(topics)
      .map((t) => tagMap[t] || t)
      .filter(Boolean);
  }
}
