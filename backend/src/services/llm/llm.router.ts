/**
 * ════════════════════════════════════════════════════════════
 *  LLM ROUTER — Provider selection + automatic fallback
 * ════════════════════════════════════════════════════════════
 *
 *  Routes LLM requests through primary (Claude) and falls
 *  back to secondary (OpenAI) on failure. Implements:
 *
 *  1. Circuit breaker pattern
 *  2. Automatic failover
 *  3. Request retry with exponential backoff
 *  4. Provider health tracking
 *  5. Cost-aware routing (use cheaper model for classification)
 * ════════════════════════════════════════════════════════════
 */

import { ClaudeProvider, LLMError } from './llm.provider.js';
import { OpenAIProvider } from './openai.provider.js';
import type { LLMProvider, LLMToolCallRequest, LLMResponse } from './llm.provider.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openedAt: number;
}

const CIRCUIT_THRESHOLD = 5;       // Failures before opening circuit
const CIRCUIT_RESET_MS = 60_000;   // Reset after 1 minute
const RETRY_DELAYS = [500, 1000, 2000]; // Exponential backoff

export class LLMRouter implements LLMProvider {
  private primary: LLMProvider;
  private fallback: LLMProvider | null;
  private primaryCircuit: CircuitState;
  private fallbackCircuit: CircuitState;

  constructor() {
    const env = getEnv();

    this.primary = new ClaudeProvider(env.ANTHROPIC_API_KEY);

    this.fallback = env.OPENAI_API_KEY
      ? new OpenAIProvider(env.OPENAI_API_KEY)
      : null;

    this.primaryCircuit = { failures: 0, lastFailure: 0, isOpen: false, openedAt: 0 };
    this.fallbackCircuit = { failures: 0, lastFailure: 0, isOpen: false, openedAt: 0 };
  }

  /**
   * Route a tool-use request through primary → fallback
   */
  async createWithTools(request: LLMToolCallRequest): Promise<LLMResponse> {
    // Try primary
    if (!this.isCircuitOpen(this.primaryCircuit)) {
      try {
        const result = await this.withRetry(() => this.primary.createWithTools(request));
        this.recordSuccess(this.primaryCircuit);
        return result;
      } catch (err) {
        this.recordFailure(this.primaryCircuit);
        logger.warn({ err, provider: 'claude' }, 'Primary LLM failed, attempting fallback');
      }
    } else {
      logger.warn('Primary LLM circuit open, skipping to fallback');
    }

    // Try fallback
    if (this.fallback && !this.isCircuitOpen(this.fallbackCircuit)) {
      try {
        const result = await this.withRetry(() => this.fallback!.createWithTools(request));
        this.recordSuccess(this.fallbackCircuit);
        return result;
      } catch (err) {
        this.recordFailure(this.fallbackCircuit);
        logger.error({ err, provider: 'openai' }, 'Fallback LLM also failed');
      }
    }

    throw new LLMError(
      'All LLM providers are currently unavailable. Please try again in a moment.',
      'ALL_PROVIDERS_DOWN',
    );
  }

  /**
   * Route a simple completion through primary → fallback
   */
  async complete(system: string, prompt: string, maxTokens?: number): Promise<string> {
    if (!this.isCircuitOpen(this.primaryCircuit)) {
      try {
        const result = await this.primary.complete(system, prompt, maxTokens);
        this.recordSuccess(this.primaryCircuit);
        return result;
      } catch (err) {
        this.recordFailure(this.primaryCircuit);
        logger.warn({ err }, 'Primary LLM completion failed');
      }
    }

    if (this.fallback && !this.isCircuitOpen(this.fallbackCircuit)) {
      try {
        const result = await this.fallback.complete(system, prompt, maxTokens);
        this.recordSuccess(this.fallbackCircuit);
        return result;
      } catch (err) {
        this.recordFailure(this.fallbackCircuit);
      }
    }

    throw new LLMError('All LLM providers unavailable', 'ALL_PROVIDERS_DOWN');
  }

  /**
   * Get current health status of providers
   */
  getHealth(): { primary: string; fallback: string } {
    return {
      primary: this.isCircuitOpen(this.primaryCircuit) ? 'circuit_open' : 'healthy',
      fallback: this.fallback
        ? (this.isCircuitOpen(this.fallbackCircuit) ? 'circuit_open' : 'healthy')
        : 'not_configured',
    };
  }

  // ─── Circuit Breaker ───────────────────────────────────

  private isCircuitOpen(state: CircuitState): boolean {
    if (!state.isOpen) return false;

    // Check if enough time has passed to try again (half-open)
    if (Date.now() - state.openedAt > CIRCUIT_RESET_MS) {
      state.isOpen = false;
      state.failures = 0;
      logger.info('Circuit breaker reset, retrying provider');
      return false;
    }

    return true;
  }

  private recordSuccess(state: CircuitState): void {
    state.failures = 0;
    state.isOpen = false;
  }

  private recordFailure(state: CircuitState): void {
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= CIRCUIT_THRESHOLD) {
      state.isOpen = true;
      state.openedAt = Date.now();
      logger.warn({ failures: state.failures }, 'Circuit breaker opened');
    }
  }

  // ─── Retry with backoff ────────────────────────────────

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;

        // Don't retry on auth errors or validation errors
        if (err instanceof LLMError && (err.code === 'AUTH_ERROR' || err.code === 'VALIDATION_ERROR')) {
          throw err;
        }

        if (attempt < maxRetries) {
          const delay = RETRY_DELAYS[attempt] || 2000;
          logger.debug({ attempt, delay }, 'Retrying LLM call');
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }
}
