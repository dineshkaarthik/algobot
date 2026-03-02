/**
 * ════════════════════════════════════════════════════════════
 *  PROMETHEUS METRICS
 * ════════════════════════════════════════════════════════════
 *
 *  Exposes application metrics for Prometheus scraping.
 *  Covers: HTTP requests, LLM calls, WebSocket connections,
 *  agent performance, and business metrics.
 * ════════════════════════════════════════════════════════════
 */

import { getRedis } from '../../config/redis.js';

/**
 * In-memory counters (lightweight, no external dependency).
 * For production with multiple pods, use Redis-backed counters
 * or a proper Prometheus client library.
 */
class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private gauges: Map<string, number> = new Map();

  // ─── Counter methods ───────────────────────────────────

  increment(name: string, labels?: Record<string, string>, amount = 1): void {
    const key = this.labeledKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + amount);
  }

  // ─── Gauge methods ─────────────────────────────────────

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.labeledKey(name, labels);
    this.gauges.set(key, value);
  }

  // ─── Histogram methods ─────────────────────────────────

  observe(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.labeledKey(name, labels);
    const arr = this.histograms.get(key) || [];
    arr.push(value);
    // Keep last 1000 observations
    if (arr.length > 1000) arr.shift();
    this.histograms.set(key, arr);
  }

  // ─── Export in Prometheus format ────────────────────────

  export(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      lines.push(`# TYPE ${this.baseName(key)} counter`);
      lines.push(`${key} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      lines.push(`# TYPE ${this.baseName(key)} gauge`);
      lines.push(`${key} ${value}`);
    }

    // Histograms (simplified — sum, count, percentiles)
    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const p50 = sorted[Math.floor(count * 0.5)] || 0;
      const p95 = sorted[Math.floor(count * 0.95)] || 0;
      const p99 = sorted[Math.floor(count * 0.99)] || 0;

      lines.push(`# TYPE ${this.baseName(key)} histogram`);
      lines.push(`${key}_sum ${sum}`);
      lines.push(`${key}_count ${count}`);
      lines.push(`${key}{quantile="0.5"} ${p50}`);
      lines.push(`${key}{quantile="0.95"} ${p95}`);
      lines.push(`${key}{quantile="0.99"} ${p99}`);
    }

    return lines.join('\n');
  }

  private labeledKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) return name;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private baseName(key: string): string {
    return key.split('{')[0];
  }
}

// ─── Singleton ───────────────────────────────────────────

export const metrics = new MetricsCollector();

// ─── Pre-defined metric helpers ──────────────────────────

export const MetricNames = {
  // HTTP
  HTTP_REQUESTS_TOTAL: 'algo_http_requests_total',
  HTTP_REQUEST_DURATION: 'algo_http_request_duration_ms',
  HTTP_ERRORS_TOTAL: 'algo_http_errors_total',

  // Agent
  AGENT_REQUESTS_TOTAL: 'algo_agent_requests_total',
  AGENT_DURATION: 'algo_agent_duration_ms',
  AGENT_TOOL_CALLS: 'algo_agent_tool_calls_total',
  AGENT_ITERATIONS: 'algo_agent_iterations',

  // LLM
  LLM_REQUESTS_TOTAL: 'algo_llm_requests_total',
  LLM_DURATION: 'algo_llm_duration_ms',
  LLM_TOKENS_INPUT: 'algo_llm_tokens_input_total',
  LLM_TOKENS_OUTPUT: 'algo_llm_tokens_output_total',
  LLM_ERRORS_TOTAL: 'algo_llm_errors_total',
  LLM_FALLBACKS_TOTAL: 'algo_llm_fallbacks_total',

  // WebSocket
  WS_CONNECTIONS_ACTIVE: 'algo_ws_connections_active',
  WS_MESSAGES_SENT: 'algo_ws_messages_sent_total',

  // Business
  CONVERSATIONS_CREATED: 'algo_conversations_created_total',
  MESSAGES_PROCESSED: 'algo_messages_processed_total',
  ACTIONS_CONFIRMED: 'algo_actions_confirmed_total',
  ACTIONS_CANCELLED: 'algo_actions_cancelled_total',
  ALERTS_TRIGGERED: 'algo_alerts_triggered_total',
  PUSH_SENT: 'algo_push_notifications_sent_total',
} as const;

// ─── Metrics route ───────────────────────────────────────

import type { FastifyInstance } from 'fastify';

export async function metricsRoute(app: FastifyInstance) {
  app.get('/api/v1/metrics', async (_request, reply) => {
    // Update dynamic gauges
    const { getConnectedClients } = await import('../websocket/ws.server.js');
    metrics.setGauge(MetricNames.WS_CONNECTIONS_ACTIVE, getConnectedClients().size);

    reply.header('Content-Type', 'text/plain; version=0.0.4');
    return reply.send(metrics.export());
  });
}
