/**
 * ════════════════════════════════════════════════════════════
 *  CLEANUP WORKER — Periodic maintenance tasks
 * ════════════════════════════════════════════════════════════
 *
 *  Runs periodic maintenance:
 *  1. Expire pending actions (>5 min old)
 *  2. Archive old conversations (>90 days)
 *  3. Clean up expired refresh tokens
 *  4. Prune Redis cache
 * ════════════════════════════════════════════════════════════
 */

import { lt, and, eq } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { pendingActions, refreshTokens, conversations } from '../models/schema.js';
import { ActionExecutor } from '../services/ai/action.executor.js';
import { AlgonitClient } from '../services/algonit/algonit.client.js';
import { logger } from '../utils/logger.js';

export function startCleanupWorker(): ReturnType<typeof setInterval> {
  // Run every 10 minutes
  const intervalId = setInterval(async () => {
    try {
      await runCleanup();
    } catch (err) {
      logger.error({ err }, 'Cleanup worker failed');
    }
  }, 10 * 60 * 1000);

  // Also run immediately
  runCleanup().catch((err) => logger.error({ err }, 'Initial cleanup failed'));

  logger.info('Cleanup worker started (10 minute interval)');
  return intervalId;
}

async function runCleanup(): Promise<void> {
  const startTime = Date.now();
  const db = getDb();
  const now = new Date();

  // 1. Expire pending actions (cleanupExpired only touches DB, not Algonit APIs)
  const algonit = new AlgonitClient('cleanup-worker');
  const actionExecutor = new ActionExecutor(algonit);
  const expiredActions = await actionExecutor.cleanupExpired();

  // 2. Remove expired refresh tokens
  const expiredTokens = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, now))
    .returning();

  // 3. Archive old conversations (>90 days since last message)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const archivedConvs = await db
    .update(conversations)
    .set({ status: 'archived', updatedAt: now })
    .where(
      and(
        eq(conversations.status, 'active'),
        lt(conversations.updatedAt, ninetyDaysAgo),
      ),
    )
    .returning();

  const duration = Date.now() - startTime;

  if (expiredActions > 0 || expiredTokens.length > 0 || archivedConvs.length > 0) {
    logger.info(
      {
        expiredActions,
        expiredTokens: expiredTokens.length,
        archivedConversations: archivedConvs.length,
        duration_ms: duration,
      },
      'Cleanup completed',
    );
  }
}
