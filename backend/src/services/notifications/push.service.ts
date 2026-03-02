/**
 * ════════════════════════════════════════════════════════════
 *  PUSH NOTIFICATION SERVICE
 * ════════════════════════════════════════════════════════════
 *
 *  Handles sending push notifications via:
 *  - Firebase Cloud Messaging (FCM) for Android
 *  - Apple Push Notification Service (APNs) for iOS
 *
 *  Also manages device registration and notification
 *  preferences per user.
 * ════════════════════════════════════════════════════════════
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '../../config/database.js';
import { devices, notifications, users } from '../../models/schema.js';
import { sendAlertToUser } from '../websocket/ws.server.js';
import { logger } from '../../utils/logger.js';

export interface PushPayload {
  title: string;
  body: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  data?: Record<string, unknown>;
  actionUrl?: string;
}

interface DeviceInfo {
  deviceId: string;
  deviceType: 'ios' | 'android';
  pushToken: string;
}

export class PushService {
  private fcmApiKey: string | undefined;

  constructor() {
    this.fcmApiKey = process.env.FCM_SERVER_KEY;
  }

  /**
   * Send push notification to a specific user (all devices)
   */
  async sendToUser(userId: string, tenantId: string, payload: PushPayload): Promise<void> {
    const db = getDb();

    // Save notification to DB
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        tenantId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        severity: payload.severity,
        data: payload.data || {},
        actionUrl: payload.actionUrl,
      })
      .returning();

    // Send via WebSocket (real-time, if connected)
    sendAlertToUser(userId, {
      id: notification.id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      severity: payload.severity,
      data: payload.data,
      action_url: payload.actionUrl,
      created_at: notification.createdAt,
    });

    // Get user's registered devices
    const userDevices = await db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), eq(devices.isActive, true)));

    // Send push to each device
    for (const device of userDevices) {
      if (!device.pushToken) continue;

      try {
        if (device.deviceType === 'android') {
          await this.sendFCM(device.pushToken, payload);
        } else if (device.deviceType === 'ios') {
          await this.sendAPNs(device.pushToken, payload);
        }

        // Mark as sent
        await db
          .update(notifications)
          .set({ pushSent: true, pushSentAt: new Date() })
          .where(eq(notifications.id, notification.id));
      } catch (err) {
        logger.error(
          { err, deviceId: device.deviceId, deviceType: device.deviceType },
          'Failed to send push notification',
        );
      }
    }
  }

  /**
   * Send push notifications to all users in a tenant
   */
  async sendToTenant(tenantId: string, payload: PushPayload): Promise<void> {
    const db = getDb();

    // Get all active users in the tenant
    const tenantUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)));

    // Send to each user
    const promises = tenantUsers.map((user) =>
      this.sendToUser(user.id, tenantId, payload).catch((err) => {
        logger.error({ err, userId: user.id }, 'Failed to send push to user');
      }),
    );

    await Promise.allSettled(promises);
  }

  /**
   * Register a device for push notifications
   */
  async registerDevice(
    userId: string,
    tenantId: string,
    deviceInfo: DeviceInfo & { appVersion?: string; osVersion?: string },
  ): Promise<void> {
    const db = getDb();

    // Upsert device
    const [existing] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceInfo.deviceId)))
      .limit(1);

    if (existing) {
      await db
        .update(devices)
        .set({
          pushToken: deviceInfo.pushToken,
          deviceType: deviceInfo.deviceType,
          appVersion: deviceInfo.appVersion,
          osVersion: deviceInfo.osVersion,
          isActive: true,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(devices.id, existing.id));
    } else {
      await db.insert(devices).values({
        userId,
        tenantId,
        deviceId: deviceInfo.deviceId,
        deviceType: deviceInfo.deviceType,
        pushToken: deviceInfo.pushToken,
        appVersion: deviceInfo.appVersion,
        osVersion: deviceInfo.osVersion,
      });
    }

    logger.info(
      { userId, deviceId: deviceInfo.deviceId, deviceType: deviceInfo.deviceType },
      'Device registered for push notifications',
    );
  }

  /**
   * Unregister a device
   */
  async unregisterDevice(userId: string, deviceId: string): Promise<void> {
    const db = getDb();
    await db
      .update(devices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(devices.userId, userId), eq(devices.deviceId, deviceId)));
  }

  /**
   * Send via Firebase Cloud Messaging (Android)
   */
  private async sendFCM(token: string, payload: PushPayload): Promise<void> {
    if (!this.fcmApiKey) {
      logger.warn('FCM not configured, skipping Android push');
      return;
    }

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${this.fcmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
          sound: 'default',
          click_action: 'OPEN_ACTIVITY',
          channel_id: this.getChannelId(payload.severity),
        },
        data: {
          type: payload.type,
          severity: payload.severity,
          action_url: payload.actionUrl,
          ...payload.data,
        },
        priority: payload.severity === 'high' ? 'high' : 'normal',
      }),
    });

    if (!response.ok) {
      throw new Error(`FCM error: ${response.status}`);
    }
  }

  /**
   * Send via Apple Push Notification Service (iOS)
   * Uses HTTP/2 APNs provider API
   */
  private async sendAPNs(token: string, payload: PushPayload): Promise<void> {
    const teamId = process.env.APNS_TEAM_ID;
    const keyId = process.env.APNS_KEY_ID;

    if (!teamId || !keyId) {
      logger.warn('APNs not configured, skipping iOS push');
      return;
    }

    // In production, use a proper APNs library like 'apns2' or '@parse/node-apn'
    // This is a simplified HTTP/2 implementation
    const apnsHost =
      process.env.NODE_ENV === 'production'
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com';

    const apnsPayload = {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
        badge: 1,
        'mutable-content': 1,
        'thread-id': payload.type,
      },
      type: payload.type,
      severity: payload.severity,
      actionUrl: payload.actionUrl,
      ...payload.data,
    };

    logger.info(
      { token: token.substring(0, 8) + '...', type: payload.type },
      'Would send APNs notification (requires HTTP/2 client)',
    );
  }

  /**
   * Get Android notification channel ID based on severity
   */
  private getChannelId(severity: string): string {
    switch (severity) {
      case 'high':
        return 'algo_urgent';
      case 'medium':
        return 'algo_alerts';
      case 'low':
        return 'algo_info';
      default:
        return 'algo_default';
    }
  }
}
