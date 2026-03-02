/**
 * ════════════════════════════════════════════════════════════
 *  ALERT WORKER — Background alert checking
 * ════════════════════════════════════════════════════════════
 *
 *  Runs as a separate process or alongside the main server.
 *  Periodically checks business metrics and triggers
 *  proactive push notifications.
 * ════════════════════════════════════════════════════════════
 */

import { AlertEngine } from '../services/notifications/alert.engine.js';
import { PushService } from '../services/notifications/push.service.js';
import { logger } from '../utils/logger.js';

export function startAlertWorker(): AlertEngine {
  const pushService = new PushService();
  const engine = new AlertEngine(pushService);

  // Run every 5 minutes
  engine.start(5 * 60 * 1000);

  logger.info('Alert worker started (5 minute interval)');

  return engine;
}
