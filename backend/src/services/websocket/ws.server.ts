/**
 * ════════════════════════════════════════════════════════════
 *  WEBSOCKET SERVER — Real-time streaming & alerts
 * ════════════════════════════════════════════════════════════
 *
 *  Provides:
 *  1. Streaming agent responses (chunked text)
 *  2. Typing indicators
 *  3. Real-time alert delivery
 *  4. Dashboard metric updates
 * ════════════════════════════════════════════════════════════
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  tenantId: string;
  deviceId?: string;
  connectedAt: Date;
  lastPing: Date;
}

// Global connection registry
const clients = new Map<string, ConnectedClient>();

// Tenant → Set<userId> for broadcasting
const tenantClients = new Map<string, Set<string>>();

export function getConnectedClients() {
  return clients;
}

export function getTenantClients() {
  return tenantClients;
}

/**
 * Register WebSocket routes on the Fastify instance
 */
export async function registerWebSocket(app: FastifyInstance) {
  app.get('/api/v1/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as any)?.token;
    if (!token) {
      socket.close(4001, 'Missing authentication token');
      return;
    }

    // Verify JWT
    let decoded: { sub: string; tid: string; role: string; did?: string };
    try {
      decoded = app.jwt.verify<typeof decoded>(token);
    } catch {
      socket.close(4001, 'Invalid or expired token');
      return;
    }

    const clientKey = `${decoded.sub}:${decoded.did || 'default'}`;

    // Register client
    const client: ConnectedClient = {
      ws: socket,
      userId: decoded.sub,
      tenantId: decoded.tid,
      deviceId: decoded.did,
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    clients.set(clientKey, client);

    // Track by tenant
    if (!tenantClients.has(decoded.tid)) {
      tenantClients.set(decoded.tid, new Set());
    }
    tenantClients.get(decoded.tid)!.add(decoded.sub);

    // Track in Redis for cross-pod awareness
    const redis = getRedis();
    redis.sadd(`ws:${decoded.sub}`, process.env.HOSTNAME || 'local').catch(() => {});

    logger.info({ userId: decoded.sub, tenantId: decoded.tid }, 'WebSocket client connected');

    // Send welcome
    sendToClient(clientKey, {
      type: 'connected',
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages
    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(data.toString());
        handleClientMessage(clientKey, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    // Handle pong (heartbeat response)
    socket.on('pong', () => {
      const c = clients.get(clientKey);
      if (c) c.lastPing = new Date();
    });

    // Cleanup on disconnect
    socket.on('close', () => {
      clients.delete(clientKey);
      const tenantSet = tenantClients.get(decoded.tid);
      if (tenantSet) {
        tenantSet.delete(decoded.sub);
        if (tenantSet.size === 0) tenantClients.delete(decoded.tid);
      }
      redis.srem(`ws:${decoded.sub}`, process.env.HOSTNAME || 'local').catch(() => {});
      logger.info({ userId: decoded.sub }, 'WebSocket client disconnected');
    });

    socket.on('error', (err: Error) => {
      logger.error({ err, userId: decoded.sub }, 'WebSocket error');
    });
  });

  // Heartbeat interval — ping every 30s, drop if no pong in 60s
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const [key, client] of clients) {
      if (now - client.lastPing.getTime() > 60_000) {
        logger.warn({ userId: client.userId }, 'WebSocket client timed out');
        client.ws.terminate();
        clients.delete(key);
      } else {
        client.ws.ping();
      }
    }
  }, 30_000);

  app.addHook('onClose', () => {
    clearInterval(heartbeat);
    for (const [, client] of clients) {
      client.ws.close(1001, 'Server shutting down');
    }
    clients.clear();
  });
}

/**
 * Handle incoming client messages (e.g., read receipts)
 */
function handleClientMessage(clientKey: string, msg: any) {
  switch (msg.type) {
    case 'ping':
      sendToClient(clientKey, { type: 'pong', timestamp: new Date().toISOString() });
      break;
    case 'read_receipt':
      // Could update notification read status
      break;
    default:
      break;
  }
}

// ─── Public API for sending messages ─────────────────────

/**
 * Send a message to a specific client
 */
export function sendToClient(clientKey: string, data: Record<string, unknown>) {
  const client = clients.get(clientKey);
  if (client && client.ws.readyState === 1) {
    client.ws.send(JSON.stringify(data));
  }
}

/**
 * Send a message to all devices of a specific user
 */
export function sendToUser(userId: string, data: Record<string, unknown>) {
  for (const [key, client] of clients) {
    if (client.userId === userId && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(data));
    }
  }
}

/**
 * Broadcast to all users in a tenant
 */
export function broadcastToTenant(tenantId: string, data: Record<string, unknown>) {
  const userIds = tenantClients.get(tenantId);
  if (!userIds) return;

  for (const userId of userIds) {
    sendToUser(userId, data);
  }
}

/**
 * Stream an agent response chunk-by-chunk to the user
 */
export function streamResponseToUser(
  userId: string,
  conversationId: string,
  chunk: string,
  isFinal: boolean,
  messageId?: string,
) {
  if (isFinal) {
    sendToUser(userId, {
      type: 'stream_end',
      conversation_id: conversationId,
      message_id: messageId,
      timestamp: new Date().toISOString(),
    });
  } else {
    sendToUser(userId, {
      type: 'stream',
      conversation_id: conversationId,
      chunk,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Send typing indicator
 */
export function sendTypingIndicator(userId: string, conversationId: string, isTyping: boolean) {
  sendToUser(userId, {
    type: isTyping ? 'typing_start' : 'typing_stop',
    conversation_id: conversationId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a real-time alert to a user
 */
export function sendAlertToUser(userId: string, alert: Record<string, unknown>) {
  sendToUser(userId, {
    type: 'alert',
    alert,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send a dashboard metric update
 */
export function sendMetricUpdate(tenantId: string, metric: string, value: unknown) {
  broadcastToTenant(tenantId, {
    type: 'metric_update',
    metric,
    value,
    timestamp: new Date().toISOString(),
  });
}
