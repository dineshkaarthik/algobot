/**
 * ════════════════════════════════════════════════════════════
 *  MULTI-INTENT PARSER
 * ════════════════════════════════════════════════════════════
 *
 *  Handles compound user requests that contain multiple
 *  intents in a single message. Examples:
 *
 *  "How many leads this week, and pause the email drip"
 *   → query.leads.count + action.campaign.pause
 *
 *  "Give me a revenue report and check my credits"
 *   → action.report.generate + query.credits.balance
 *
 *  "How are things going?" (implicit multi-intent)
 *   → query.campaign.status + query.leads.count
 *     + query.credits.balance + query.leads.followup
 *
 *  Strategy:
 *  1. Detect if the message contains multiple intents
 *  2. Split into segments
 *  3. Order: queries first, then actions
 *  4. Actions still require confirmation individually
 * ════════════════════════════════════════════════════════════
 */

import type { LLMProvider } from '../llm/llm.provider.js';
import { logger } from '../../utils/logger.js';

export interface IntentSegment {
  segment: string;
  intent: string;
  category: 'query' | 'action';
  confidence: number;
  entities: Record<string, unknown>;
}

export interface MultiIntentResult {
  isMultiIntent: boolean;
  segments: IntentSegment[];
  executionOrder: IntentSegment[];
  originalMessage: string;
}

const MULTI_INTENT_PROMPT = `You are an intent segmentation engine for a marketing/sales platform assistant.

Given a user message, determine if it contains MULTIPLE distinct requests. If so, split them into segments.

## Rules
1. A message with ONE request = single intent (most messages).
2. A message joined by "and", "also", "plus", "then", commas, or semicolons may be multi-intent.
3. Broad questions like "How are things going?" or "Give me a full update" should be treated as a SINGLE intent (the agent handles the breadth internally by calling multiple tools).
4. "Create X and then do Y with it" is a sequential multi-intent.
5. Queries always execute before actions.
6. Each action requires its own confirmation.

## Intent Categories
- query: Read-only data retrieval
- action: Write/mutate operation

## Output Format (JSON only)
{
  "is_multi_intent": false,
  "segments": [
    {
      "segment": "the exact text portion",
      "intent": "query.leads.count",
      "category": "query",
      "confidence": 0.95,
      "entities": {}
    }
  ]
}

User message: "{MESSAGE}"`;

export class MultiIntentParser {
  constructor(private llm: LLMProvider) {}

  /**
   * Detect and split multi-intent messages
   */
  async parse(message: string): Promise<MultiIntentResult> {
    // Quick heuristic check — skip LLM call for obviously single-intent messages
    if (this.isLikelySingleIntent(message)) {
      return {
        isMultiIntent: false,
        segments: [],
        executionOrder: [],
        originalMessage: message,
      };
    }

    try {
      const prompt = MULTI_INTENT_PROMPT.replace('{MESSAGE}', message);
      const response = await this.llm.complete(
        'You are a precise intent segmentation engine. Return ONLY valid JSON.',
        prompt,
        500,
      );

      const parsed = JSON.parse(this.extractJson(response));

      if (!parsed.is_multi_intent || !parsed.segments || parsed.segments.length <= 1) {
        return {
          isMultiIntent: false,
          segments: [],
          executionOrder: [],
          originalMessage: message,
        };
      }

      const segments: IntentSegment[] = parsed.segments.map((s: any) => ({
        segment: s.segment,
        intent: s.intent,
        category: s.category as 'query' | 'action',
        confidence: s.confidence,
        entities: s.entities || {},
      }));

      // Order: queries first, then actions
      const executionOrder = [
        ...segments.filter((s) => s.category === 'query'),
        ...segments.filter((s) => s.category === 'action'),
      ];

      logger.info(
        { segmentCount: segments.length, intents: segments.map((s) => s.intent) },
        'Multi-intent detected',
      );

      return {
        isMultiIntent: true,
        segments,
        executionOrder,
        originalMessage: message,
      };
    } catch (err) {
      logger.debug({ err }, 'Multi-intent parsing failed, treating as single intent');
      return {
        isMultiIntent: false,
        segments: [],
        executionOrder: [],
        originalMessage: message,
      };
    }
  }

  /**
   * Quick heuristic: skip LLM call for simple messages
   */
  private isLikelySingleIntent(message: string): boolean {
    const wordCount = message.split(/\s+/).length;

    // Very short messages are almost always single-intent
    if (wordCount <= 8) return true;

    // Check for multi-intent indicators
    const multiIndicators = /\b(and also|and then|plus also|also can you|, and |; )\b/i;
    if (multiIndicators.test(message)) return false;

    // Simple "and" with a verb after it suggests multi-intent
    const andWithVerb = /\band\s+(pause|create|generate|trigger|assign|send|launch|resume|delete|check|show|tell|give)\b/i;
    if (andWithVerb.test(message)) return false;

    return true;
  }

  /**
   * Extract JSON from LLM response (may contain markdown fences)
   */
  private extractJson(text: string): string {
    const jsonMatch = text.match(/```json?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) return jsonMatch[1];

    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return braceMatch[0];

    return text;
  }
}
