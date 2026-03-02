import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlgonitResilience } from '../services/algonit/algonit.resilience.js';
import {
  AlgonitAuthError,
  AlgonitUnavailableError,
  AlgonitNetworkError,
  AlgonitRateLimitError,
  AlgonitValidationError,
} from '../services/algonit/algonit.errors.js';

// Suppress logger output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Tests ────────────────────────────────────────────────

describe('AlgonitResilience', () => {
  const TENANT = 'tenant-test-001';
  let resilience: AlgonitResilience;

  beforeEach(() => {
    vi.useFakeTimers();
    resilience = new AlgonitResilience({
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 10_000, // 10s for faster tests
        halfOpenMaxAttempts: 1,
      },
      retry: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 800,
        backoffFactor: 2,
      },
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Circuit Breaker ──────────────────────────────────

  describe('circuit breaker', () => {
    it('should start in closed state', () => {
      const status = resilience.getStatus(TENANT);
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });

    it('should remain closed when operations succeed', async () => {
      await resilience.execute(TENANT, async () => 'ok');
      await resilience.execute(TENANT, async () => 'ok');

      const status = resilience.getStatus(TENANT);
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });

    it('should open after 5 consecutive failures', async () => {
      // Cause 5 failures with non-retryable errors (so no retry loops)
      for (let i = 0; i < 5; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitValidationError(400, 'bad request'); },
            { skipRetry: true },
          );
        } catch {
          // expected
        }
      }

      const status = resilience.getStatus(TENANT);
      expect(status.state).toBe('open');
      expect(status.failures).toBe(5);
    });

    it('should reject immediately with AlgonitUnavailableError when open', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitValidationError(400, 'bad request'); },
            { skipRetry: true },
          );
        } catch { /* expected */ }
      }

      // Next call should be rejected immediately
      await expect(
        resilience.execute(TENANT, async () => 'should not run'),
      ).rejects.toThrow(AlgonitUnavailableError);

      await expect(
        resilience.execute(TENANT, async () => 'should not run'),
      ).rejects.toThrow(/Circuit breaker is open/);
    });

    it('should move to half-open after resetTimeout elapses', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitValidationError(400, 'bad'); },
            { skipRetry: true },
          );
        } catch { /* expected */ }
      }

      expect(resilience.getStatus(TENANT).state).toBe('open');

      // Advance time past resetTimeout
      vi.advanceTimersByTime(11_000);

      // Now a request should be allowed (half-open trial)
      const result = await resilience.execute(TENANT, async () => 'recovered');
      expect(result).toBe('recovered');

      // Should be back to closed after success
      expect(resilience.getStatus(TENANT).state).toBe('closed');
    });

    it('should close the circuit on successful request in half-open state', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitValidationError(400, 'bad'); },
            { skipRetry: true },
          );
        } catch { /* expected */ }
      }

      // Advance past reset timeout to reach half-open
      vi.advanceTimersByTime(11_000);

      // Success in half-open should close the breaker
      await resilience.execute(TENANT, async () => 'success');

      const status = resilience.getStatus(TENANT);
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });

    it('should not count auth errors toward circuit breaker failures', async () => {
      // Send 10 auth errors — should NOT open the circuit
      for (let i = 0; i < 10; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitAuthError('token expired'); },
            { skipRetry: true },
          );
        } catch { /* expected */ }
      }

      const status = resilience.getStatus(TENANT);
      // Auth errors are non-retryable but code checks: if not AlgonitAuthError, recordFailure
      // So auth errors should NOT affect the breaker
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });
  });

  // ─── Retry with Exponential Backoff ────────────────────

  describe('retry with exponential backoff', () => {
    it('should retry on retryable errors with exponential backoff', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new AlgonitUnavailableError(500, 'server error');
        }
        return 'success-on-third-try';
      };

      // Run the operation — the retries will use setTimeout which we control
      const promise = resilience.execute(TENANT, operation);

      // Advance through retry delays: attempt 1 fails, delay ~100ms
      await vi.advanceTimersByTimeAsync(150);
      // Attempt 2 fails, delay ~200ms
      await vi.advanceTimersByTimeAsync(250);

      const result = await promise;
      expect(result).toBe('success-on-third-try');
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;

      await expect(
        resilience.execute(TENANT, async () => {
          attempts++;
          throw new AlgonitValidationError(400, 'bad request');
        }),
      ).rejects.toThrow(AlgonitValidationError);

      // Non-retryable = only 1 attempt, no retries
      expect(attempts).toBe(1);
    });

    it('should respect retryAfterSeconds for rate limit errors', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts === 1) {
          throw new AlgonitRateLimitError(0.5, 'rate limited'); // 500ms (within 800ms maxDelay)
        }
        return 'success-after-rate-limit';
      };

      const promise = resilience.execute(TENANT, operation);

      // Advance past the rate limit wait (500ms)
      await vi.advanceTimersByTimeAsync(600);

      const result = await promise;
      expect(result).toBe('success-after-rate-limit');
      expect(attempts).toBe(2);
    });

    it('should throw rate limit error if wait exceeds maxDelay', async () => {
      // Rate limit with a very long retry-after that exceeds maxDelay (800ms)
      // The 800ms maxDelay applies to backoff only; rate limit check is waitMs <= maxDelay
      await expect(
        resilience.execute(TENANT, async () => {
          throw new AlgonitRateLimitError(10, 'rate limited for 10s'); // 10000ms > 800ms maxDelay
        }),
      ).rejects.toThrow(AlgonitRateLimitError);
    });

    it('should exhaust all retries and throw the last error', async () => {
      let attempts = 0;

      const promise = resilience.execute(TENANT, async () => {
        attempts++;
        throw new AlgonitNetworkError('connection refused');
      });

      // Attach rejection handler immediately to avoid unhandled rejection warning
      const resultPromise = expect(promise).rejects.toThrow(AlgonitNetworkError);

      // Advance through all retry delays
      // Attempt 1: fail, delay ~100ms
      // Attempt 2: fail, delay ~200ms
      // Attempt 3: fail, delay ~400ms
      // Attempt 4: fail (maxRetries=3 means 4 total attempts)
      await vi.advanceTimersByTimeAsync(1000);

      await resultPromise;
      expect(attempts).toBe(4); // 1 initial + 3 retries
    });
  });

  // ─── getStatus ─────────────────────────────────────────

  describe('getStatus', () => {
    it('should return closed/0 for unknown tenant', () => {
      const status = resilience.getStatus('unknown-tenant');
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
    });

    it('should return current state and failure count', async () => {
      // Cause 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitValidationError(400, 'bad'); },
            { skipRetry: true },
          );
        } catch { /* expected */ }
      }

      const status = resilience.getStatus(TENANT);
      expect(status.state).toBe('closed'); // not yet at threshold (5)
      expect(status.failures).toBe(3);
    });
  });

  // ─── reset ─────────────────────────────────────────────

  describe('reset', () => {
    it('should clear breaker state for a tenant', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await resilience.execute(
            TENANT,
            async () => { throw new AlgonitValidationError(400, 'bad'); },
            { skipRetry: true },
          );
        } catch { /* expected */ }
      }

      expect(resilience.getStatus(TENANT).state).toBe('open');

      // Reset
      resilience.reset(TENANT);

      // Should be fresh closed state
      const status = resilience.getStatus(TENANT);
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);

      // Operations should work again immediately
      const result = await resilience.execute(TENANT, async () => 'works');
      expect(result).toBe('works');
    });

    it('should be a no-op for unknown tenant', () => {
      // Should not throw
      resilience.reset('nonexistent-tenant');
      expect(resilience.getStatus('nonexistent-tenant').state).toBe('closed');
    });
  });
});
