import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { notifications } from '../models/schema.js';

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  unread_only: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

const notificationPrefsSchema = z.object({
  hot_lead: z.object({ enabled: z.boolean(), push: z.boolean(), email: z.boolean() }).optional(),
  campaign_drop: z.object({ enabled: z.boolean(), push: z.boolean(), email: z.boolean() }).optional(),
  budget_alert: z
    .object({
      enabled: z.boolean(),
      push: z.boolean(),
      email: z.boolean(),
      threshold_pct: z.number().min(1).max(100).optional(),
    })
    .optional(),
  revenue_spike: z.object({ enabled: z.boolean(), push: z.boolean(), email: z.boolean() }).optional(),
  credit_low: z
    .object({
      enabled: z.boolean(),
      push: z.boolean(),
      email: z.boolean(),
      threshold: z.number().min(1).optional(),
    })
    .optional(),
  followup_overdue: z.object({ enabled: z.boolean(), push: z.boolean(), email: z.boolean() }).optional(),
});

export async function notificationsRoutes(app: FastifyInstance) {
  /**
   * GET /notifications — List user notifications
   */
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = paginationSchema.parse(request.query);
    const db = getDb();
    const offset = (query.page - 1) * query.limit;

    const conditions = [
      eq(notifications.userId, request.userId),
      eq(notifications.tenantId, request.tenantId),
    ];

    if (query.unread_only) {
      conditions.push(eq(notifications.isRead, false));
    }

    const result = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(query.limit)
      .offset(offset);

    // Get unread count
    const unreadResult = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, request.userId),
          eq(notifications.tenantId, request.tenantId),
          eq(notifications.isRead, false),
        ),
      );

    return reply.send({
      notifications: result.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        severity: n.severity,
        data: n.data,
        action_url: n.actionUrl,
        read: n.isRead,
        created_at: n.createdAt,
      })),
      unread_count: unreadResult.length,
      pagination: {
        page: query.page,
        limit: query.limit,
      },
    });
  });

  /**
   * POST /notifications/:id/read — Mark notification as read
   */
  app.post('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, request.userId),
        ),
      );

    return reply.send({ status: 'ok' });
  });

  /**
   * POST /notifications/read-all — Mark all notifications as read
   */
  app.post('/read-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDb();

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, request.userId),
          eq(notifications.tenantId, request.tenantId),
          eq(notifications.isRead, false),
        ),
      );

    return reply.send({ status: 'ok' });
  });

  /**
   * PUT /notifications/settings — Update notification preferences
   */
  app.put('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = notificationPrefsSchema.parse(request.body);

    // Store in Redis for fast access by alert engine
    const redis = app.redis;
    const key = `notif_prefs:${request.tenantId}:${request.userId}`;
    await redis.set(key, JSON.stringify(body));

    return reply.send({ status: 'updated', preferences: body });
  });

  /**
   * GET /notifications/settings — Get notification preferences
   */
  app.get('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const redis = app.redis;
    const key = `notif_prefs:${request.tenantId}:${request.userId}`;
    const raw = await redis.get(key);

    const defaults = {
      hot_lead: { enabled: true, push: true, email: true },
      campaign_drop: { enabled: true, push: true, email: false },
      budget_alert: { enabled: true, push: true, email: true, threshold_pct: 80 },
      revenue_spike: { enabled: true, push: false, email: true },
      credit_low: { enabled: true, push: true, email: true, threshold: 500 },
      followup_overdue: { enabled: true, push: true, email: false },
    };

    return reply.send({
      preferences: raw ? { ...defaults, ...JSON.parse(raw) } : defaults,
    });
  });
}
