// =============================================================================
// Algo Bot — k6 Load Testing Script
// =============================================================================
// Usage:
//   k6 run loadtest/k6-load-test.js
//   k6 run --env BASE_URL=https://api.staging.algonit.com loadtest/k6-load-test.js
//   k6 run --env AUTH_TOKEN=<jwt> --env TENANT_ID=<id> loadtest/k6-load-test.js
//
// WebSocket scenario:
//   k6 run --env BASE_URL=http://localhost:3000 -s websocket loadtest/k6-load-test.js
// =============================================================================

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('errors');
const chatLatency = new Trend('chat_latency');
const dashboardLatency = new Trend('dashboard_latency');
const recommendationsLatency = new Trend('recommendations_latency');
const wsConnections = new Counter('ws_connections');

// ---------------------------------------------------------------------------
// Test configuration — staged load ramp
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    http_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },    // Warm-up: ramp to 50 VUs
        { duration: '3m', target: 200 },   // Moderate load: 200 VUs
        { duration: '3m', target: 500 },   // High load: 500 VUs
        { duration: '2m', target: 1000 },  // Peak load: 1000 VUs
        { duration: '1m', target: 0 },     // Cool-down: ramp to 0
      ],
      exec: 'httpScenario',
    },
    ws_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '1m', target: 0 },
      ],
      exec: 'websocket',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    errors: ['rate<0.01'],
    chat_latency: ['p(95)<2000'],
    dashboard_latency: ['p(95)<500'],
    recommendations_latency: ['p(95)<1000'],
  },
};

// ---------------------------------------------------------------------------
// Environment & shared headers
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token';
const TENANT_ID = __ENV.TENANT_ID || 'test-tenant';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'X-Tenant-ID': TENANT_ID,
};

// Sample chat messages for realistic variation
const chatMessages = [
  'How are my campaigns performing?',
  'Show me today\'s leads',
  'What is my conversion rate this week?',
  'Send a WhatsApp message to my top leads',
  'Give me a summary of email open rates',
  'How many new contacts this month?',
  'What are my growth recommendations?',
  'Schedule a campaign for next Monday',
  'Show me revenue analytics',
  'Which leads should I follow up with?',
];

// ---------------------------------------------------------------------------
// HTTP load test scenario (default)
// ---------------------------------------------------------------------------
export function httpScenario() {
  // 1. Health check --------------------------------------------------------
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/api/v1/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health body ok': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'ok' || body.status === 'healthy';
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
  });

  // 2. Dashboard summary ---------------------------------------------------
  group('Dashboard Summary', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/dashboard/summary`, { headers });
    dashboardLatency.add(Date.now() - start);
    check(res, {
      'dashboard status 200': (r) => r.status === 200,
      'dashboard has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data !== undefined || body.summary !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
  });

  // 3. Chat message --------------------------------------------------------
  group('Chat Message', () => {
    const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/chat/message`,
      JSON.stringify({
        message,
        input_type: 'text',
      }),
      { headers, timeout: '30s' }
    );
    chatLatency.add(Date.now() - start);
    check(res, {
      'chat status 200': (r) => r.status === 200,
      'chat has response': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.response !== undefined || body.message !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(res.status !== 200);
  });

  // 4. Chat history -------------------------------------------------------
  group('Chat History', () => {
    const res = http.get(`${BASE_URL}/api/v1/chat/history?limit=20`, { headers });
    check(res, {
      'history status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // 5. Recommendations ----------------------------------------------------
  group('Recommendations', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/recommendations`, { headers });
    recommendationsLatency.add(Date.now() - start);
    check(res, {
      'recommendations status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // 6. Notifications -------------------------------------------------------
  group('Notifications', () => {
    const res = http.get(`${BASE_URL}/api/v1/notifications?limit=10`, { headers });
    check(res, {
      'notifications status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  // Pause between iterations to simulate real user think time
  sleep(Math.random() * 2 + 0.5); // 0.5–2.5 seconds
}

// ---------------------------------------------------------------------------
// WebSocket test scenario
// ---------------------------------------------------------------------------
export function websocket() {
  const wsUrl =
    BASE_URL.replace('http', 'ws') + `/api/v1/ws?token=${AUTH_TOKEN}`;

  const res = ws.connect(wsUrl, {}, (socket) => {
    socket.on('open', () => {
      wsConnections.add(1);

      // Send a ping
      socket.send(JSON.stringify({ type: 'ping' }));

      // Send a chat message over WebSocket
      socket.send(
        JSON.stringify({
          type: 'chat',
          payload: {
            message: 'What are my top campaigns?',
            input_type: 'text',
          },
        })
      );
    });

    socket.on('message', (msg) => {
      check(msg, {
        'ws message received': (m) => m.length > 0,
        'ws message is valid JSON': (m) => {
          try {
            JSON.parse(m);
            return true;
          } catch {
            return false;
          }
        },
      });
    });

    socket.on('error', (e) => {
      errorRate.add(true);
      console.error('WebSocket error:', e);
    });

    // Keep connection open for 5 seconds to receive streamed responses
    socket.setTimeout(() => {
      socket.close();
    }, 5000);
  });

  check(res, {
    'ws status 101 (switching protocols)': (r) => r && r.status === 101,
  });

  sleep(1);
}

// ---------------------------------------------------------------------------
// Smoke test — quick sanity check (run with: k6 run --iterations 1)
// ---------------------------------------------------------------------------
export function smoke() {
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, { 'smoke: health 200': (r) => r.status === 200 });

  const dashRes = http.get(`${BASE_URL}/api/v1/dashboard/summary`, { headers });
  check(dashRes, { 'smoke: dashboard 200': (r) => r.status === 200 });

  const chatRes = http.post(
    `${BASE_URL}/api/v1/chat/message`,
    JSON.stringify({ message: 'Hello', input_type: 'text' }),
    { headers }
  );
  check(chatRes, { 'smoke: chat 200': (r) => r.status === 200 });
}
