/**
 * ════════════════════════════════════════════════════════════
 *  LLM PROVIDER INTERFACE + CLAUDE IMPLEMENTATION
 * ════════════════════════════════════════════════════════════
 */

import Anthropic from '@anthropic-ai/sdk';
import { getEnv } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

// ─── Interface ───────────────────────────────────────────

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: any;
}

export interface LLMToolCallRequest {
  system: string;
  messages: LLMMessage[];
  tools: any[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: Array<
    | { type: 'text'; text: string; id?: never; name?: never; input?: never }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown>; text?: never }
  >;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  stopReason: string;
}

export interface LLMProvider {
  createWithTools(request: LLMToolCallRequest): Promise<LLMResponse>;
  complete(system: string, prompt: string, maxTokens?: number): Promise<string>;
}

// ─── Claude Provider ─────────────────────────────────────

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || getEnv().ANTHROPIC_API_KEY,
    });
    this.model = model || 'claude-sonnet-4-6';
  }

  async createWithTools(request: LLMToolCallRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.3,
        system: request.system,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tools: request.tools,
      });

      const duration = Date.now() - startTime;
      logger.debug(
        {
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          stopReason: response.stop_reason,
          duration_ms: duration,
        },
        'Claude API call completed',
      );

      return {
        content: response.content as LLMResponse['content'],
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        model: response.model,
        stopReason: response.stop_reason || 'end_turn',
      };
    } catch (error) {
      logger.error({ error, duration_ms: Date.now() - startTime }, 'Claude API call failed');

      if (error instanceof Anthropic.RateLimitError) {
        throw new LLMError('Rate limit exceeded. Please try again in a moment.', 'RATE_LIMIT');
      }
      if (error instanceof Anthropic.APIError) {
        throw new LLMError(`LLM service error: ${error.message}`, 'API_ERROR');
      }
      throw error;
    }
  }

  async complete(system: string, prompt: string, maxTokens = 1024): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock && textBlock.type === 'text' ? textBlock.text : '';
  }
}

export class LLMError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'LLMError';
  }
}
