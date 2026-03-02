import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlgonitClient, _resetSingletons } from '../services/algonit/algonit.client.js';
import {
  AlgonitAuthError,
  AlgonitUnavailableError,
} from '../services/algonit/algonit.errors.js';

// ─── Mock Infrastructure ──────────────────────────────────

const TEST_ENV = {
  ALGONIT_API_URL: 'https://www.algonit.com/api/algo',
  NODE_ENV: 'development',
  TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
};

vi.mock('../config/env.js', () => ({
  getEnv: () => TEST_ENV,
}));

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  scan: vi.fn().mockResolvedValue(['0', []]),
};

vi.mock('../config/redis.js', () => ({
  getRedis: () => mockRedis,
}));

const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
};

const mockDb = {
  select: vi.fn().mockReturnValue(mockSelectChain),
  insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }),
  update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }),
};

vi.mock('../config/database.js', () => ({
  getDb: () => mockDb,
}));

vi.mock('../models/schema.js', () => ({
  algonitConnections: { tenantId: 'tenant_id', accessTokenEnc: 'access_token_enc', status: 'status' },
  tenants: { id: 'id', algonitOrgId: 'algonit_org_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val }),
}));

const mockGetAccessToken = vi.fn().mockResolvedValue('test-access-token');
vi.mock('../services/algonit/algonit.token.store.js', () => ({
  AlgonitTokenStore: class {
    getAccessToken = mockGetAccessToken;
  },
}));

vi.mock('../services/algonit/algonit.auth.js', () => ({
  AlgonitAuth: class {
    verifyToken = vi.fn();
    revokeToken = vi.fn();
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Globals ──────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;
const TENANT_ID = 'tenant-test-001';

// ─── Tests ────────────────────────────────────────────────

describe('AlgonitClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    _resetSingletons();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── Constructor ──────────────────────────────────────

  describe('constructor', () => {
    it('should require a tenantId', () => {
      const client = new AlgonitClient(TENANT_ID);
      expect(client).toBeDefined();
    });

    it('should use mock mode in development environment', async () => {
      const client = new AlgonitClient(TENANT_ID);
      const result = await client.getCreditsBalance();

      expect(result).toBeDefined();
      expect(result.balance).toBe(4500);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── Mock Mode: All Methods Return Correct Data ────

  describe('mock mode (development)', () => {
    let client: AlgonitClient;

    beforeEach(() => {
      TEST_ENV.NODE_ENV = 'development';
      client = new AlgonitClient(TENANT_ID);
    });

    // Live query tools (16)

    it('getProfile returns typed mock data', async () => {
      const result = await client.getProfile();
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(4);
      expect(result.user.email).toBeDefined();
      expect(result.user.firstName).toBe('Demo');
      expect(result.user.company).toBe('Demo Corp');
    });

    it('getCreditsBalance returns typed mock data', async () => {
      const result = await client.getCreditsBalance();
      expect(result.balance).toBe(4500);
      expect(result.planCredits).toBe(3000);
      expect(result.topUpCredits).toBe(1500);
      expect(result.monthlyAllocation).toBe(5000);
      expect(result.recentTransactions).toHaveLength(5);
    });

    it('getPosts returns typed mock data', async () => {
      const result = await client.getPosts();
      expect(result.posts).toHaveLength(3);
      expect(result.summary.total).toBe(3);
      expect(result.summary.published).toBe(2);
      expect(result.summary.scheduled).toBe(1);
      expect(result.posts[0].postType).toBe('image');
    });

    it('listCampaigns returns typed mock data', async () => {
      const result = await client.listCampaigns();
      expect(result.campaigns).toHaveLength(5);
      expect(result.campaigns[0].id).toBe(23);
      expect(result.campaigns[0].platforms).toContain('instagram');
      expect(result.campaigns[0].campaignType).toBe('social');
    });

    it('getCampaignPerformance returns typed mock data', async () => {
      const result = await client.getCampaignPerformance('23');
      expect(result.campaign.id).toBe(23);
      expect(result.totals.impressions).toBe(18500);
      expect(result.totals.ctr).toBe(8.9);
      expect(result.dateRange).toBeDefined();
      expect(result.byPlatform).toHaveLength(2);
    });

    it('getEmailCampaigns returns typed mock data', async () => {
      const result = await client.getEmailCampaigns();
      expect(result.campaigns).toHaveLength(3);
      expect(result.campaigns[0].audienceSegment).toBe('new_users');
      expect(result.campaigns[0].openRate).toBe('40.0%');
    });

    it('getMarketRadar returns typed mock data', async () => {
      const result = await client.getMarketRadar();
      expect(result.recentSignals).toHaveLength(3);
      expect(result.competitors.total).toBe(3);
      expect(result.competitors.names).toHaveLength(3);
      expect(result.signals.unread).toBe(3);
    });

    it('getDashboardSummary returns typed mock data', async () => {
      const result = await client.getDashboardSummary();
      expect(result.campaigns.active).toBe(4);
      expect(result.credits.balance).toBe(4500);
      expect(result.posts.published).toBe(8);
      expect(result.marketRadar.unreadSignals).toBe(3);
      expect(result.user.name).toBe('Demo User');
    });

    it('getHotLeads returns typed mock data', async () => {
      const result = await client.getHotLeads();
      expect(result.hotLeads).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.minScoreFilter).toBe(70);
      expect(result.hotLeads[0].urgency).toBe('high');
      expect(result.hotLeads[0].leadScore).toBe(92);
    });

    it('getBuyingIntent returns typed mock data', async () => {
      const result = await client.getBuyingIntent();
      expect(result.signals).toHaveLength(3);
      expect(result.signals[0].priority).toBe('high');
      expect(result.signals[0].actionNeeded).toBe(true);
      expect(result.signals[0].intentScore).toBe(85);
      expect(result.minIntentFilter).toBe(50);
    });

    it('getFollowUps returns typed mock data', async () => {
      const result = await client.getFollowUps();
      expect(result.followUps).toHaveLength(3);
      expect(result.followUps[0].daysSinceLastContact).toBe(5);
      expect(result.followUps[0].overdueSeverity).toBe('high');
      expect(result.staleDaysFilter).toBe(3);
    });

    it('getDeals returns typed mock data', async () => {
      const result = await client.getDeals();
      expect(result.deals).toHaveLength(5);
      expect(result.totalPipelineValue).toBe(189000);
      expect(result.currency).toBe('USD');
      expect(result.deals[0].weightedValue).toBe(31500);
      expect(result.byStage).toBeDefined();
    });

    it('getSocialEngagement returns typed mock data', async () => {
      const result = await client.getSocialEngagement();
      expect(result.byPlatform).toHaveLength(4);
      expect(result.overall.totalEngagements).toBe(3837);
      expect(result.byPlatform[0].reach).toBeDefined();
      expect(result.byPlatform[0].avgCtr).toBe(7.2);
      expect(result.totalRecords).toBe(45);
    });

    it('getLeads returns typed mock data', async () => {
      const result = await client.getLeads();
      expect(result.total).toBe(47);
      expect(result.byStage).toBeDefined();
      expect(result.bySource).toBeDefined();
      expect(result.avgLeadScore).toBe(58.3);
      expect(result.leads[0].isHot).toBe(true);
      expect(result.qualified).toBe(30);
    });

    it('getInsights returns typed mock data', async () => {
      const result = await client.getInsights();
      expect(result.period.days).toBe(28);
      expect(result.insights).toHaveLength(5);
      expect(result.insights[0]).toContain('reels outperform');
      expect(result.byContentType).toHaveLength(3);
      expect(result.byContentType[0].platform).toBe('instagram');
      expect(result.topPosts).toHaveLength(2);
      expect(result.topPosts[0].totalEngagement).toBe(379);
      expect(result.campaignPerformanceByPlatform).toHaveLength(3);
    });

    // Live action tools (2)

    it('pauseCampaign returns typed mock data', async () => {
      const result = await client.pauseCampaign('23');
      expect(result.success).toBe(true);
      expect(result.campaign.status).toBe('paused');
      expect(result.campaign.id).toBe(23);
    });

    it('resumeCampaign returns typed mock data', async () => {
      const result = await client.resumeCampaign('23');
      expect(result.success).toBe(true);
      expect(result.campaign.status).toBe('active');
    });

    // Deferred action tools (5, always mock)

    it('createCampaign returns mock data', async () => {
      const result = await client.createCampaign({
        name: 'Test Campaign',
        platform: 'instagram',
        type: 'social',
      });
      expect(result.success).toBe(true);
      expect(result.campaign.name).toBe('Test Campaign');
      expect(result.campaign.status).toBe('draft');
    });

    it('generateContent returns mock data', async () => {
      const result = await client.generateContent('instagram', 'product launch', 'casual');
      expect(result.success).toBe(true);
      expect(result.content.platform).toBe('instagram');
      expect(result.content.tone).toBe('casual');
      expect(result.credits_used).toBe(5);
    });

    it('triggerFollowup returns mock data', async () => {
      const result = await client.triggerFollowup('lead_001', 'email');
      expect(result.success).toBe(true);
      expect(result.followup.lead_id).toBe('lead_001');
    });

    it('assignTask returns mock data', async () => {
      const result = await client.assignTask('user-001', 'call', 'Follow up with lead');
      expect(result.success).toBe(true);
      expect(result.task.type).toBe('call');
    });

    it('generateReport returns mock data', async () => {
      const result = await client.generateReport('monthly', '2026-02-01', '2026-02-28');
      expect(result.success).toBe(true);
      expect(result.report.type).toBe('monthly');
    });

    it('should not call fetch in mock mode', async () => {
      await client.getCreditsBalance();
      await client.getHotLeads();
      await client.pauseCampaign('23');

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  // ─── Production Mode: Request Pipeline ─────────────────

  describe('production mode', () => {
    let client: AlgonitClient;

    beforeEach(() => {
      TEST_ENV.NODE_ENV = 'production';
      _resetSingletons();
      client = new AlgonitClient(TENANT_ID);
    });

    afterEach(() => {
      TEST_ENV.NODE_ENV = 'development';
    });

    it('should call the request pipeline: token -> fetch -> validate -> cache', async () => {
      const mockApiResponse = {
        balance: 5000,
        planCredits: 2000,
        topUpCredits: 3000,
        monthlyAllocation: 5000,
        totalSpent: -5000,
        recentTransactions: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
        headers: new Map(),
      });

      const result = await client.getCreditsBalance();

      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/credits');
      // Token is injected via Bearer header
      expect(options.headers.Authorization).toMatch(/^Bearer /);

      expect(result.balance).toBe(5000);
    });

    it('should return cached data without calling fetch for GET requests', async () => {
      const cachedData = JSON.stringify({
        balance: 9999,
        planCredits: 5000,
        topUpCredits: 4999,
        monthlyAllocation: 10000,
        totalSpent: -1,
        recentTransactions: [],
      });

      mockRedis.get.mockResolvedValueOnce(cachedData);

      const result = await client.getCreditsBalance();

      expect(result.balance).toBe(9999);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should invalidate cache on write operations', async () => {
      const mockResponse = {
        success: true,
        campaign: { id: 1, name: 'Test', status: 'paused' },
        message: 'Paused',
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Map(),
      });

      await client.pauseCampaign('1');

      expect(mockRedis.scan).toHaveBeenCalled();
    });

    it('should trigger token refresh and retry on 401 response', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: { get: () => null },
          };
        }
        return {
          ok: true,
          json: () => Promise.resolve({
            balance: 5000,
            planCredits: 2000,
            topUpCredits: 3000,
            monthlyAllocation: 5000,
            totalSpent: -5000,
            recentTransactions: [],
          }),
          headers: new Map(),
        };
      });

      const result = await client.getCreditsBalance();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(mockGetAccessToken).toHaveBeenCalledTimes(2);
      expect(result.balance).toBe(5000);
    });

    it('should route 5xx errors through circuit breaker', { timeout: 60000 }, async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        headers: { get: () => null },
      });

      // Each call goes through retries (4 attempts) with exponential backoff.
      // After 5+ failures the circuit breaker opens.
      // We need at least 2 full calls (2 × 4 = 8 failures > threshold of 5).
      for (let i = 0; i < 2; i++) {
        try {
          await client.getCreditsBalance();
        } catch {
          // expected — 503 errors after all retries exhausted
        }
      }

      // Circuit should be open now — subsequent calls fail immediately
      await expect(client.getCreditsBalance()).rejects.toThrow(AlgonitUnavailableError);
    });
  });
});
