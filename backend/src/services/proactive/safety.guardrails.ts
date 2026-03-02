/**
 * ════════════════════════════════════════════════════════════
 *  SAFETY GUARDRAILS — Rate limiting + action safety
 * ════════════════════════════════════════════════════════════
 *
 *  Prevents runaway automation by enforcing:
 *  - Max actions per hour (default 5)
 *  - Max actions per day (default 20)
 *  - Mandatory confirmation for all actions (v1)
 *  - Blocked action types (configurable)
 *
 *  Uses Redis counters with TTL for efficient tracking.
 * ════════════════════════════════════════════════════════════
 */

import { getRedis } from '../../config/redis.js';
import type { SafetyLimits } from '../../types/proactive.types.js';
import { logger } from '../../utils/logger.js';

const DEFAULT_LIMITS: SafetyLimits = {
  maxActionsPerHour: 5,
  maxActionsPerDay: 20,
  requireConfirmation: true,
  blockedActions: [],
};

const HOURLY_KEY_PREFIX = 'safety:actions:hourly:';
const DAILY_KEY_PREFIX = 'safety:actions:daily:';
const HOURLY_TTL = 3600;
const DAILY_TTL = 86400;

export class SafetyGuardrails {
  private limits: SafetyLimits;

  constructor(limits?: Partial<SafetyLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /**
   * Check if an action can proceed
   */
  async canExecute(
    tenantId: string,
    actionType: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check blocked actions
    if (this.limits.blockedActions.includes(actionType)) {
      return { allowed: false, reason: `Action type '${actionType}' is blocked by safety policy` };
    }

    const redis = getRedis();

    // Check hourly limit
    const hourlyKey = `${HOURLY_KEY_PREFIX}${tenantId}`;
    const hourlyCount = parseInt((await redis.get(hourlyKey)) || '0', 10);
    if (hourlyCount >= this.limits.maxActionsPerHour) {
      return {
        allowed: false,
        reason: `Hourly action limit reached (${this.limits.maxActionsPerHour}/hour). Try again later.`,
      };
    }

    // Check daily limit
    const dailyKey = `${DAILY_KEY_PREFIX}${tenantId}`;
    const dailyCount = parseInt((await redis.get(dailyKey)) || '0', 10);
    if (dailyCount >= this.limits.maxActionsPerDay) {
      return {
        allowed: false,
        reason: `Daily action limit reached (${this.limits.maxActionsPerDay}/day). Resets at midnight.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Record an executed action (call after successful execution)
   */
  async recordExecution(tenantId: string): Promise<void> {
    const redis = getRedis();

    const hourlyKey = `${HOURLY_KEY_PREFIX}${tenantId}`;
    const hourlyExists = await redis.exists(hourlyKey);
    await redis.incr(hourlyKey);
    if (!hourlyExists) {
      await redis.expire(hourlyKey, HOURLY_TTL);
    }

    const dailyKey = `${DAILY_KEY_PREFIX}${tenantId}`;
    const dailyExists = await redis.exists(dailyKey);
    await redis.incr(dailyKey);
    if (!dailyExists) {
      await redis.expire(dailyKey, DAILY_TTL);
    }

    logger.debug({ tenantId }, 'Safety: action execution recorded');
  }

  /**
   * Get current safety status for a tenant
   */
  async getStatus(
    tenantId: string,
  ): Promise<{ hourlyUsed: number; dailyUsed: number; limits: SafetyLimits }> {
    const redis = getRedis();

    const hourlyCount = parseInt(
      (await redis.get(`${HOURLY_KEY_PREFIX}${tenantId}`)) || '0',
      10,
    );
    const dailyCount = parseInt(
      (await redis.get(`${DAILY_KEY_PREFIX}${tenantId}`)) || '0',
      10,
    );

    return {
      hourlyUsed: hourlyCount,
      dailyUsed: dailyCount,
      limits: this.limits,
    };
  }
}
