/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT API — TYPED ERROR CLASSES
 * ════════════════════════════════════════════════════════════
 *
 *  Structured error hierarchy for Algonit API integration.
 *  Enables the resilience layer (circuit breaker, retry logic,
 *  token refresh) to make decisions based on error type.
 *
 *  Error classification:
 *    AlgonitError (base)
 *    ├── AlgonitAuthError          — 401, trigger token refresh
 *    ├── AlgonitRateLimitError     — 429, respect Retry-After
 *    ├── AlgonitUnavailableError   — 5xx, circuit breaker tracks
 *    ├── AlgonitValidationError    — 4xx (not 401/429), no retry
 *    ├── AlgonitNetworkError       — timeout/DNS/connection
 *    └── AlgonitNotConnectedError  — tenant not connected
 * ════════════════════════════════════════════════════════════
 */

/**
 * Minimal headers interface — compatible with both the global fetch Headers
 * and Node.js undici Headers without requiring DOM lib types.
 */
interface ResponseHeaders {
  get(name: string): string | null;
}

// ─── Base Error ──────────────────────────────────────────

export class AlgonitError extends Error {
  public override readonly name: string = 'AlgonitError';

  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly originalError?: unknown,
  ) {
    super(message);

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace, excluding the constructor from the trace (V8/Node.js)
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, new.target);
    }
  }

  /**
   * Serialize to a plain object for logging / structured telemetry.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

// ─── 401 — Auth / Token Expired ──────────────────────────

/**
 * Thrown when the Algonit API returns 401 Unauthorized.
 * The resilience layer should refresh the access token and retry once.
 */
export class AlgonitAuthError extends AlgonitError {
  public override readonly name = 'AlgonitAuthError';

  constructor(message?: string, originalError?: unknown) {
    super(
      message ?? 'Algonit authentication failed — token may be expired',
      401,
      'ALGONIT_AUTH_ERROR',
      true, // retryable after token refresh
      originalError,
    );
  }
}

// ─── 429 — Rate Limit Exceeded ───────────────────────────

/**
 * Thrown when the Algonit API returns 429 Too Many Requests.
 * The caller should wait `retryAfterSeconds` before retrying.
 */
export class AlgonitRateLimitError extends AlgonitError {
  public override readonly name = 'AlgonitRateLimitError';

  constructor(
    public readonly retryAfterSeconds: number,
    message?: string,
    originalError?: unknown,
  ) {
    super(
      message ?? `Algonit rate limit exceeded — retry after ${retryAfterSeconds}s`,
      429,
      'ALGONIT_RATE_LIMIT',
      true, // retryable after delay
      originalError,
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}

// ─── 5xx — Server Unavailable ────────────────────────────

/**
 * Thrown when the Algonit API returns a 5xx status code.
 * The circuit breaker should track these to determine when to open.
 */
export class AlgonitUnavailableError extends AlgonitError {
  public override readonly name = 'AlgonitUnavailableError';

  constructor(statusCode?: number, message?: string, originalError?: unknown) {
    super(
      message ?? `Algonit service unavailable (HTTP ${statusCode ?? 500})`,
      statusCode ?? 500,
      'ALGONIT_UNAVAILABLE',
      true, // retryable with backoff
      originalError,
    );
  }
}

// ─── 4xx — Validation / Client Error ─────────────────────

/**
 * Thrown for 4xx responses that are NOT 401 or 429.
 * Covers bad requests (400), forbidden (403), not found (404),
 * and other client-side validation errors.
 * These should NOT be retried — the request itself is invalid.
 */
export class AlgonitValidationError extends AlgonitError {
  public override readonly name = 'AlgonitValidationError';

  constructor(
    statusCode: number,
    message?: string,
    public readonly validationDetails?: Record<string, unknown>,
    originalError?: unknown,
  ) {
    super(
      message ?? `Algonit validation error (HTTP ${statusCode})`,
      statusCode,
      'ALGONIT_VALIDATION_ERROR',
      false, // not retryable
      originalError,
    );
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationDetails: this.validationDetails,
    };
  }
}

// ─── Network Errors — Timeout / DNS / Connection ─────────

/**
 * Thrown when the request never reaches Algonit servers.
 * Covers TCP timeouts, DNS resolution failures, connection refused,
 * and other network-level errors (typically a TypeError from fetch).
 */
export class AlgonitNetworkError extends AlgonitError {
  public override readonly name = 'AlgonitNetworkError';

  constructor(message?: string, originalError?: unknown) {
    super(
      message ?? 'Network error communicating with Algonit API',
      0, // no HTTP status — request never completed
      'ALGONIT_NETWORK_ERROR',
      true, // retryable with backoff
      originalError,
    );
  }
}

// ─── Not Connected — Tenant Integration Missing ──────────

/**
 * Thrown when a tenant has not connected their Algonit account.
 * This is a permanent condition that cannot be resolved by retrying;
 * the user must set up the integration first.
 */
export class AlgonitNotConnectedError extends AlgonitError {
  public override readonly name = 'AlgonitNotConnectedError';

  constructor(tenantId?: string, originalError?: unknown) {
    super(
      tenantId
        ? `Tenant ${tenantId} has not connected their Algonit account`
        : 'Algonit account not connected — integration setup required',
      0,
      'ALGONIT_NOT_CONNECTED',
      false, // not retryable — user action required
      originalError,
    );
  }
}

// ─── Error Classification Helper ─────────────────────────

/** Default Retry-After value in seconds when the header is missing on a 429. */
const DEFAULT_RETRY_AFTER_SECONDS = 30;

/**
 * Classify a raw error (from fetch or other sources) into the correct
 * typed AlgonitError subclass so the resilience layer can act on it.
 *
 * @param error         - The raw error caught from a fetch call or other source.
 * @param statusCode    - HTTP status code, if available from the response.
 * @param headers       - Response headers, used to extract Retry-After on 429.
 * @returns A properly typed AlgonitError instance.
 *
 * @example
 * ```ts
 * try {
 *   const res = await fetch(url, options);
 *   if (!res.ok) throw classifyError(new Error(res.statusText), res.status, res.headers);
 *   return await res.json();
 * } catch (err) {
 *   throw err instanceof AlgonitError ? err : classifyError(err);
 * }
 * ```
 */
export function classifyError(
  error: unknown,
  statusCode?: number,
  headers?: ResponseHeaders,
): AlgonitError {
  // If it's already a classified AlgonitError, return as-is
  if (error instanceof AlgonitError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // ── Status-code-based classification ──────────────────

  if (statusCode !== undefined) {
    // 401 — Authentication failure
    if (statusCode === 401) {
      return new AlgonitAuthError(
        `Algonit API authentication failed: ${message}`,
        error,
      );
    }

    // 429 — Rate limit exceeded
    if (statusCode === 429) {
      const retryAfter = parseRetryAfter(headers);
      return new AlgonitRateLimitError(
        retryAfter,
        `Algonit rate limit exceeded: ${message}`,
        error,
      );
    }

    // 5xx — Server errors
    if (statusCode >= 500 && statusCode < 600) {
      return new AlgonitUnavailableError(
        statusCode,
        `Algonit server error (${statusCode}): ${message}`,
        error,
      );
    }

    // 4xx (not 401/429) — Client / validation errors
    if (statusCode >= 400 && statusCode < 500) {
      return new AlgonitValidationError(
        statusCode,
        `Algonit client error (${statusCode}): ${message}`,
        extractValidationDetails(error),
        error,
      );
    }
  }

  // ── Network-level errors (no status code) ─────────────

  // fetch() throws TypeError on network failures (DNS, connection refused,
  // abort, etc.) per the WHATWG Fetch spec.
  if (error instanceof TypeError) {
    return new AlgonitNetworkError(
      `Algonit network error: ${message}`,
      error,
    );
  }

  // AbortError from AbortController timeout
  if (
    error instanceof Error &&
    error.name === 'AbortError'
  ) {
    return new AlgonitNetworkError(
      `Algonit request timed out: ${message}`,
      error,
    );
  }

  // Specific error message patterns that indicate network issues
  if (error instanceof Error) {
    const lowerMessage = message.toLowerCase();
    if (
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('econnreset') ||
      lowerMessage.includes('etimedout') ||
      lowerMessage.includes('enotfound') ||
      lowerMessage.includes('socket hang up') ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('dns')
    ) {
      return new AlgonitNetworkError(
        `Algonit network error: ${message}`,
        error,
      );
    }
  }

  // ── Fallback — treat unknowns as unavailable (retryable) ─

  return new AlgonitUnavailableError(
    0,
    `Algonit unknown error: ${message}`,
    error,
  );
}

// ─── Internal Helpers ────────────────────────────────────

/**
 * Parse the Retry-After header value.
 * Supports both seconds (integer) and HTTP-date formats.
 * Falls back to DEFAULT_RETRY_AFTER_SECONDS if missing or unparseable.
 */
function parseRetryAfter(headers?: ResponseHeaders): number {
  if (!headers) return DEFAULT_RETRY_AFTER_SECONDS;

  const retryAfterHeader = headers.get('retry-after');
  if (!retryAfterHeader) return DEFAULT_RETRY_AFTER_SECONDS;

  // Try parsing as an integer (seconds)
  const seconds = Number.parseInt(retryAfterHeader, 10);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return seconds;
  }

  // Try parsing as an HTTP-date (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
  const date = new Date(retryAfterHeader);
  if (!Number.isNaN(date.getTime())) {
    const deltaMs = date.getTime() - Date.now();
    const deltaSec = Math.ceil(deltaMs / 1000);
    return deltaSec > 0 ? deltaSec : DEFAULT_RETRY_AFTER_SECONDS;
  }

  return DEFAULT_RETRY_AFTER_SECONDS;
}

/**
 * Attempt to extract validation details from an error object.
 * Many APIs include a JSON body with field-level errors on 4xx.
 */
function extractValidationDetails(error: unknown): Record<string, unknown> | undefined {
  if (error && typeof error === 'object' && 'body' in error) {
    const body = (error as { body: unknown }).body;
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>;
    }
  }
  return undefined;
}
