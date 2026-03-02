import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  setex: vi.fn(),
};

vi.mock('../../src/config/redis.js', () => ({
  getRedis: () => mockRedis,
}));

import { TokenBudgetManager } from '../../src/services/llm/token.budget.js';

describe('TokenBudgetManager', () => {
  const manager = new TokenBudgetManager();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkBudget', () => {
    it('should return budget status with remaining tokens', async () => {
      mockRedis.get.mockResolvedValue('10000');
      mockRedis.ttl.mockResolvedValue(1800);

      const status = await manager.checkBudget('tenant_1', 'basic');

      expect(status.used).toBe(10000);
      expect(status.limit).toBe(50000);
      expect(status.remaining).toBe(40000);
      expect(status.percentUsed).toBe(20);
      expect(status.isExhausted).toBe(false);
    });

    it('should detect exhausted budget', async () => {
      mockRedis.get.mockResolvedValue('60000');
      mockRedis.ttl.mockResolvedValue(900);

      const status = await manager.checkBudget('tenant_1', 'basic');

      expect(status.remaining).toBe(0);
      expect(status.isExhausted).toBe(true);
    });

    it('should use correct limits per plan', async () => {
      mockRedis.get.mockResolvedValue('0');
      mockRedis.ttl.mockResolvedValue(-1);

      const freeStatus = await manager.checkBudget('t1', 'free');
      expect(freeStatus.limit).toBe(5000);

      const basicStatus = await manager.checkBudget('t1', 'basic');
      expect(basicStatus.limit).toBe(50000);

      const bizStatus = await manager.checkBudget('t1', 'business');
      expect(bizStatus.limit).toBe(200000);
    });
  });

  describe('recordUsage', () => {
    it('should increment all counters', async () => {
      mockRedis.incrby.mockResolvedValue(1500);
      mockRedis.expire.mockResolvedValue(1);

      await manager.recordUsage('tenant_1', {
        inputTokens: 1000,
        outputTokens: 500,
        provider: 'claude',
        model: 'claude-sonnet-4-6',
      });

      // Should increment hourly, daily, monthly, and provider counters
      expect(mockRedis.incrby).toHaveBeenCalledTimes(4);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        'token_budget:tenant_1',
        1500,
      );
    });
  });
});
