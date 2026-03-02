import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PushService } from '../services/notifications/push.service.js';

const registerDeviceSchema = z.object({
  device_id: z.string().min(1),
  device_type: z.enum(['ios', 'android']),
  push_token: z.string().min(1),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
});

export async function devicesRoutes(app: FastifyInstance) {
  const pushService = new PushService();

  /**
   * POST /devices/register — Register device for push notifications
   */
  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerDeviceSchema.parse(request.body);

    await pushService.registerDevice(request.userId, request.tenantId, {
      deviceId: body.device_id,
      deviceType: body.device_type,
      pushToken: body.push_token,
      appVersion: body.app_version,
      osVersion: body.os_version,
    });

    return reply.send({ status: 'registered' });
  });

  /**
   * DELETE /devices/:deviceId — Unregister a device
   */
  app.delete('/:deviceId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.params as { deviceId: string };
    await pushService.unregisterDevice(request.userId, deviceId);
    return reply.send({ status: 'unregistered' });
  });
}
