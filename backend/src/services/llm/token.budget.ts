/**
 * ════════════════════════════════════════════════════════════
 *  TOKEN BUDGET MANAGER
 * ════════════════════════════════════════════════════════════
 *
 *  Tracks and enforces per-tenant LLM token budgets.
 *  Prevents runaway costs from chatty users or loops.
 *
 *  Budget tiers (per hour):
 *  - Free:     5,000 tokens/hr
 *  - Basic:   50,000 tokens/hr
 *  - Business: 200,000 tokens/hr
 *
 *  Also tracks daily/monthly aggregates for billing.
 * ════════════════════════════════════════════════════════════
 */

import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

const PLAN_LIMITS: Record<string, number> = {
  free: 5_000,
  basic: 50_000,
  business: 200_000,
};

const WINDOW_SECONDS = 3600; // 1 hour sliding window

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  provider: string;
  model: string;
}

export interface BudgetStatus {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  resetInSeconds: number;
  isExhausted: boolean;
}

export class TokenBudgetManager {
  /**
   * Check if a tenant has budget remaining before making an LLM call
   */
  async checkBudget(tenantId: string, plan: string): Promise<BudgetStatus> {
    const redis = getRedis();
    const key = `token_budget:${tenantId}`;
    const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;

    const used = parseInt(await redis.get(key) || '0', 10);
    const ttl = await redis.ttl(key);
    const remaining = Math.max(0, limit - used);

    return {
      used,
      limit,
      remaining,
      percentUsed: Math.round((used / limit) * 100),
      resetInSeconds: ttl > 0 ? ttl : WINDOW_SECONDS,
      isExhausted: remaining <= 0,
    };
  }

  /**
   * Record token usage after an LLM call
   */
  async recordUsage(tenantId: string, usage: TokenUsage): Promise<void> {
    const redis = getRedis();
    const totalTokens = usage.inputTokens + usage.outputTokens;

    // Hourly sliding window
    const hourlyKey = `token_budget:${tenantId}`;
    const current = await redis.incrby(hourlyKey, totalTokens);
    if (current === totalTokens) {
      // First usage in this window — set TTL
      await redis.expire(hourlyKey, WINDOW_SECONDS);
    }

    // Daily aggregate (for billing/analytics)
    const today = new Date().toISOString().split('T')[0];
    const dailyKey = `token_daily:${tenantId}:${today}`;
    await redis.incrby(dailyKey, totalTokens);
    await redis.expire(dailyKey, 86400 * 7); // Keep 7 days

    // Monthly aggregate
    const month = today.substring(0, 7); // YYYY-MM
    const monthlyKey = `token_monthly:${tenantId}:${month}`;
    await redis.incrby(monthlyKey, totalTokens);
    await redis.expire(monthlyKey, 86400 * 45); // Keep 45 days

    // Track by provider/model for cost allocation
    const providerKey = `token_provider:${tenantId}:${today}:${usage.provider}`;
    await redis.incrby(providerKey, totalTokens);
    await redis.expire(providerKey, 86400 * 7);

    // Log if approaching limit
    const plan = 'basic'; // TODO: fetch from tenant record
    const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.basic;
    if (current > limit * 0.8) {
      logger.warn(
        { tenantId, used: current, limit, pct: Math.round((current / limit) * 100) },
        'Tenant approaching token budget limit',
      );
    }
  }

  /**
   * Get usage analytics for a tenant
   */
  async getUsageStats(tenantId: string): Promise<{
    hourly: number;
    daily: number;
    monthly: number;
    byProvider: Record<string, number>;
  }> {
    const redis = getRedis();
    const today = new Date().toISOString().split('T')[0];
    const month = today.substring(0, 7);

    const [hourly, daily, monthly] = await Promise.all([
      redis.get(`token_budget:${tenantId}`),
      redis.get(`token_daily:${tenantId}:${today}`),
      redis.get(`token_monthly:${tenantId}:${month}`),
    ]);

    // Get per-provider breakdown
    const claudeTokens = await redis.get(`token_provider:${tenantId}:${today}:claude`);
    const openaiTokens = await redis.get(`token_provider:${tenantId}:${today}:openai`);

    return {
      hourly: parseInt(hourly || '0', 10),
      daily: parseInt(daily || '0', 10),
      monthly: parseInt(monthly || '0', 10),
      byProvider: {
        claude: parseInt(claudeTokens || '0', 10),
        openai: parseInt(openaiTokens || '0', 10),
      },
    };
  }
}
