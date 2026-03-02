/**
 * ════════════════════════════════════════════════════════════
 *  OPENAI PROVIDER — Fallback LLM
 * ════════════════════════════════════════════════════════════
 *
 *  Used when Claude API is unavailable. Translates the
 *  unified LLMProvider interface to OpenAI's API format.
 * ════════════════════════════════════════════════════════════
 */

import type { LLMProvider, LLMToolCallRequest, LLMResponse } from './llm.provider.js';
import { LLMError } from './llm.provider.js';
import { logger } from '../../utils/logger.js';

export class OpenAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || 'gpt-4o';
  }

  async createWithTools(request: LLMToolCallRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    // Convert Anthropic tool format to OpenAI function format
    const functions = request.tools.map((tool: any) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    // Convert messages
    const messages: any[] = [
      { role: 'system', content: request.system },
      ...request.messages.map((m) => {
        if (m.role === 'user' && Array.isArray(m.content)) {
          // Tool results from Anthropic format → OpenAI format
          const toolResults = m.content.filter((c: any) => c.type === 'tool_result');
          if (toolResults.length > 0) {
            return toolResults.map((tr: any) => ({
              role: 'tool' as const,
              tool_call_id: tr.tool_use_id,
              content: tr.content,
            }));
          }
        }
        if (m.role === 'assistant' && Array.isArray(m.content)) {
          // Anthropic assistant blocks → OpenAI format
          const textParts = m.content.filter((c: any) => c.type === 'text');
          const toolCalls = m.content.filter((c: any) => c.type === 'tool_use');

          return {
            role: 'assistant',
            content: textParts.map((t: any) => t.text).join('') || null,
            tool_calls: toolCalls.length > 0
              ? toolCalls.map((tc: any) => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.name,
                    arguments: JSON.stringify(tc.input),
                  },
                }))
              : undefined,
          };
        }
        return { role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
      }),
    ].flat();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          tools: functions,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.3,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 429) {
          throw new LLMError('OpenAI rate limit exceeded', 'RATE_LIMIT');
        }
        throw new LLMError(`OpenAI API error: ${response.status} ${errBody}`, 'API_ERROR');
      }

      const data = (await response.json()) as any;
      const choice = data.choices[0];
      const message = choice.message;

      // Convert OpenAI response → unified format
      const content: LLMResponse['content'] = [];

      if (message.content) {
        content.push({ type: 'text' as const, text: message.content });
      }

      if (message.tool_calls) {
        for (const tc of message.tool_calls) {
          content.push({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
      }

      logger.debug({
        provider: 'openai',
        model: this.model,
        duration_ms: Date.now() - startTime,
        tokens: data.usage,
      }, 'OpenAI call completed');

      return {
        content,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        model: data.model,
        stopReason: choice.finish_reason || 'stop',
      };
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError(`OpenAI request failed: ${(err as Error).message}`, 'API_ERROR');
    }
  }

  async complete(system: string, prompt: string, maxTokens = 1024): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      throw new LLMError(`OpenAI error: ${response.status}`, 'API_ERROR');
    }

    const data = (await response.json()) as any;
    return data.choices[0]?.message?.content || '';
  }
}
