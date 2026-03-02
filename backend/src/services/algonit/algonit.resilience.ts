import { logger } from '../../utils/logger.js';
import {
  AlgonitError,
  AlgonitAuthError,
  AlgonitRateLimitError,
  AlgonitUnavailableError,
  AlgonitNetworkError,
  AlgonitValidationError,
  classifyError,
} from './algonit.errors.js';

// Circuit breaker states
type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;  // failures before opening (default: 5)
  resetTimeout: number;       // ms before trying half-open (default: 60000)
  halfOpenMaxAttempts: number; // attempts in half-open (default: 1)
}

interface RetryConfig {
  maxRetries: number;     // default: 3
  baseDelay: number;      // ms, default: 1000
  maxDelay: number;       // ms, default: 8000
  backoffFactor: number;  // default: 2
}

interface ResilienceConfig {
  circuitBreaker: CircuitBreakerConfig;
  retry: RetryConfig;
  timeout: number; // request timeout ms, default: 10000
}

const DEFAULT_CONFIG: ResilienceConfig = {
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
    halfOpenMaxAttempts: 1,
  },
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffFactor: 2,
  },
  timeout: 10000,
};

class TenantCircuitBreaker {
  state: CircuitState = 'closed';
  failures = 0;
  lastFailureTime = 0;
  halfOpenAttempts = 0;

  constructor(private config: CircuitBreakerConfig) {}

  canAttempt(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        return true;
      }
      return false;
    }
    // half-open
    return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
  }

  recordSuccess(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenAttempts = 0;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      logger.warn({ failures: this.failures }, 'Algonit circuit breaker opened');
    }
  }
}

export class AlgonitResilience {
  private breakers = new Map<string, TenantCircuitBreaker>();
  private config: ResilienceConfig;

  constructor(config?: Partial<ResilienceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getBreaker(tenantId: string): TenantCircuitBreaker {
    let breaker = this.breakers.get(tenantId);
    if (!breaker) {
      breaker = new TenantCircuitBreaker(this.config.circuitBreaker);
      this.breakers.set(tenantId, breaker);
    }
    return breaker;
  }

  // Execute a request through the resilience pipeline:
  // circuit breaker check -> timeout -> retry on failure
  async execute<T>(
    tenantId: string,
    operation: (signal: AbortSignal) => Promise<T>,
    options?: { skipRetry?: boolean },
  ): Promise<T> {
    const breaker = this.getBreaker(tenantId);

    if (!breaker.canAttempt()) {
      throw new AlgonitUnavailableError(
        503,
        `Circuit breaker is open for tenant ${tenantId}. Algonit API may be down.`,
      );
    }

    let lastError: AlgonitError | undefined;
    const maxAttempts = options?.skipRetry ? 1 : this.config.retry.maxRetries + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Add timeout via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const result = await operation(controller.signal);
          clearTimeout(timeoutId);
          breaker.recordSuccess();
          return result;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      } catch (err) {
        const classified = err instanceof AlgonitError ? err : classifyError(err);
        lastError = classified;

        // Don't retry non-retryable errors
        if (!classified.retryable) {
          // Auth errors don't count toward circuit breaker (they're token issues, not Algonit being down)
          if (!(classified instanceof AlgonitAuthError)) {
            breaker.recordFailure();
          }
          throw classified;
        }

        // Record failure for circuit breaker
        if (classified instanceof AlgonitUnavailableError || classified instanceof AlgonitNetworkError) {
          breaker.recordFailure();
        }

        // Rate limit: wait for Retry-After
        if (classified instanceof AlgonitRateLimitError) {
          const waitMs = classified.retryAfterSeconds * 1000;
          if (attempt < maxAttempts - 1 && waitMs <= this.config.retry.maxDelay) {
            await this.sleep(waitMs);
            continue;
          }
          throw classified;
        }

        // Exponential backoff for retryable errors
        if (attempt < maxAttempts - 1) {
          const delay = Math.min(
            this.config.retry.baseDelay * Math.pow(this.config.retry.backoffFactor, attempt),
            this.config.retry.maxDelay,
          );
          const jitter = delay * 0.1 * Math.random();
          await this.sleep(delay + jitter);
        }
      }
    }

    throw lastError || new AlgonitUnavailableError(503, 'All retry attempts exhausted');
  }

  // Get circuit breaker status (for health checks)
  getStatus(tenantId: string): { state: CircuitState; failures: number } {
    const breaker = this.breakers.get(tenantId);
    if (!breaker) return { state: 'closed', failures: 0 };
    return { state: breaker.state, failures: breaker.failures };
  }

  // Reset a tenant's circuit breaker (manual override)
  reset(tenantId: string): void {
    this.breakers.delete(tenantId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
