import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebhookValidator, type WebhookPayload } from '../services/algonit/webhook.validator.js';
import { WebhookHandler } from '../services/algonit/webhook.handler.js';

// ─── Mock Infrastructure ──────────────────────────────────

// Mock Redis
const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

vi.mock('../config/redis.js', () => ({
  getRedis: () => mockRedis,
}));

// Chainable query builder mocks for select
const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
};

// Chainable query builder mocks for insert
const insertChain = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 'evt-001' }]),
};

// Chainable query builder mocks for update
const updateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
};

// Mock DB — configure mockReturnValue inline so it's set before vi.mock hoisting executes
const mockDb = {
  select: vi.fn().mockReturnValue(selectChain),
  insert: vi.fn().mockReturnValue(insertChain),
  update: vi.fn().mockReturnValue(updateChain),
};

vi.mock('../config/database.js', () => ({
  getDb: () => mockDb,
}));

// Mock schema table references (drizzle needs these for .from() / .where())
vi.mock('../models/schema.js', () => ({
  tenants: { id: 'id', algonitOrgId: 'algonit_org_id' },
  webhookEvents: { id: 'id', tenantId: 'tenant_id', status: 'status' },
}));

// Mock drizzle-orm eq helper
vi.mock('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val }),
}));

// Mock AlgonitTokenStore
const mockGetWebhookSecret = vi.fn();
vi.mock('../services/algonit/algonit.token.store.js', () => ({
  AlgonitTokenStore: class {
    getWebhookSecret = mockGetWebhookSecret;
  },
}));

// Mock PushService
const mockSendToTenant = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/notifications/push.service.js', () => ({
  PushService: class {
    sendToTenant = mockSendToTenant;
  },
}));

// Suppress logger output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Helpers ──────────────────────────────────────────────

const WEBHOOK_SECRET = 'whsec_test_secret_123';
const TENANT_ID = 'tenant-uuid-001';
const ALGONIT_ORG_ID = 'org_algonit_test';

function createPayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
  return {
    event_type: 'lead.scored',
    algonit_org_id: ALGONIT_ORG_ID,
    timestamp: new Date().toISOString(),
    nonce: `nonce_${Date.now()}_${Math.random()}`,
    data: { lead_name: 'Sarah Johnson', company: 'TechCorp', score: 92 },
    ...overrides,
  };
}

function signPayload(rawBody: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

// ─── WebhookValidator Tests ───────────────────────────────

describe('WebhookValidator', () => {
  let validator: WebhookValidator;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply chainable mock return values (vi.clearAllMocks resets them)
    mockDb.select.mockReturnValue(selectChain);
    mockDb.insert.mockReturnValue(insertChain);
    mockDb.update.mockReturnValue(updateChain);
    selectChain.from.mockReturnThis();
    selectChain.where.mockReturnThis();
    insertChain.values.mockReturnThis();
    updateChain.set.mockReturnThis();

    validator = new WebhookValidator();

    // Default: tenant lookup succeeds
    selectChain.limit.mockResolvedValue([{ id: TENANT_ID }]);

    // Default: webhook secret is available
    mockGetWebhookSecret.mockResolvedValue(WEBHOOK_SECRET);

    // Default: nonce is unique (NX set succeeds)
    mockRedis.set.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Valid Signature ──────────────────────────────────

  describe('valid signature', () => {
    it('should pass validation with correct signature', async () => {
      const payload = createPayload();
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      const result = await validator.validate(rawBody, signature);

      expect(result.valid).toBe(true);
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.payload).toBeDefined();
      expect(result.payload!.event_type).toBe('lead.scored');
      expect(result.error).toBeUndefined();
    });
  });

  // ─── Invalid Signature ────────────────────────────────

  describe('invalid signature', () => {
    it('should reject when signature does not match', async () => {
      const payload = createPayload();
      const rawBody = JSON.stringify(payload);
      const wrongSignature = signPayload(rawBody, 'wrong-secret');

      const result = await validator.validate(rawBody, wrongSignature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject a tampered body', async () => {
      const payload = createPayload();
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      // Tamper with body after signing
      const tamperedBody = rawBody.replace('Sarah Johnson', 'Evil Actor');

      const result = await validator.validate(tamperedBody, signature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });
  });

  // ─── Missing Signature ────────────────────────────────

  describe('missing signature', () => {
    it('should reject when signature header is undefined', async () => {
      const payload = createPayload();
      const rawBody = JSON.stringify(payload);

      const result = await validator.validate(rawBody, undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing X-Algonit-Signature header');
    });
  });

  // ─── Expired Timestamp ────────────────────────────────

  describe('expired timestamp', () => {
    it('should reject events older than 5 minutes', async () => {
      const oldDate = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
      const payload = createPayload({ timestamp: oldDate.toISOString() });
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      const result = await validator.validate(rawBody, signature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event timestamp too old or in the future');
    });
  });

  // ─── Future Timestamp ─────────────────────────────────

  describe('future timestamp', () => {
    it('should reject events more than 5 minutes in the future', async () => {
      const futureDate = new Date(Date.now() + 6 * 60 * 1000); // 6 minutes from now
      const payload = createPayload({ timestamp: futureDate.toISOString() });
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      const result = await validator.validate(rawBody, signature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event timestamp too old or in the future');
    });
  });

  // ─── Duplicate Nonce (Replay) ─────────────────────────

  describe('duplicate nonce (replay)', () => {
    it('should reject when nonce was already seen', async () => {
      const payload = createPayload();
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      // Simulate Redis NX returning null (key already exists)
      mockRedis.set.mockResolvedValue(null);

      const result = await validator.validate(rawBody, signature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Duplicate event (replay detected)');
    });

    it('should store nonce in Redis with 10 min TTL on first occurrence', async () => {
      const payload = createPayload({ nonce: 'unique-nonce-123' });
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      mockRedis.set.mockResolvedValue('OK');

      await validator.validate(rawBody, signature);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'algonit:webhook:nonce:unique-nonce-123',
        '1',
        'EX',
        600,
        'NX',
      );
    });
  });

  // ─── Unknown org_id ───────────────────────────────────

  describe('unknown org_id', () => {
    it('should reject when no tenant matches the algonit_org_id', async () => {
      // No tenant found
      selectChain.limit.mockResolvedValue([]);

      const payload = createPayload({ algonit_org_id: 'org_unknown' });
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, WEBHOOK_SECRET);

      const result = await validator.validate(rawBody, signature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unknown Algonit org: org_unknown');
    });
  });

  // ─── Invalid JSON / Missing Fields ────────────────────

  describe('malformed payloads', () => {
    it('should reject invalid JSON', async () => {
      const result = await validator.validate('not-json{{{', 'some-sig');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JSON payload');
    });

    it('should reject payload missing required fields', async () => {
      const rawBody = JSON.stringify({ event_type: 'lead.scored' }); // missing org_id, timestamp, nonce

      const result = await validator.validate(rawBody, 'some-sig');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing required fields');
    });
  });
});

// ─── WebhookHandler Tests ─────────────────────────────────

describe('WebhookHandler', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-apply chainable mock return values (vi.clearAllMocks resets them)
    mockDb.select.mockReturnValue(selectChain);
    mockDb.insert.mockReturnValue(insertChain);
    mockDb.update.mockReturnValue(updateChain);
    selectChain.from.mockReturnThis();
    selectChain.where.mockReturnThis();
    insertChain.values.mockReturnThis();
    updateChain.set.mockReturnThis();

    handler = new WebhookHandler();

    // Default: insert returns event ID
    insertChain.returning.mockResolvedValue([{ id: 'evt-001' }]);
    // Default: update succeeds
    updateChain.where.mockResolvedValue(undefined);
    // Default: push succeeds
    mockSendToTenant.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('event processing', () => {
    it('should store the event in the database with received status', async () => {
      const payload = createPayload();

      await handler.handle(TENANT_ID, payload, 'sha256=abc');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          eventType: 'lead.scored',
          signature: 'sha256=abc',
          status: 'received',
        }),
      );
    });

    it('should create push notifications for known event types', async () => {
      const payload = createPayload({
        event_type: 'lead.scored',
        data: { lead_name: 'Sarah Johnson', company: 'TechCorp', score: 92 },
      });

      await handler.handle(TENANT_ID, payload, 'sha256=abc');

      // processEvent runs async — wait for micro-tasks
      await vi.waitFor(() => {
        expect(mockSendToTenant).toHaveBeenCalled();
      });

      expect(mockSendToTenant).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          title: 'Hot Lead Detected',
          type: 'hot_lead',
          severity: 'high',
        }),
      );
    });

    it('should send push notifications to the tenant', async () => {
      const payload = createPayload({
        event_type: 'campaign.performance_drop',
        data: { campaign_name: 'Spring Sale', drop_pct: 25 },
      });

      await handler.handle(TENANT_ID, payload, 'sha256=abc');

      await vi.waitFor(() => {
        expect(mockSendToTenant).toHaveBeenCalled();
      });

      expect(mockSendToTenant).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          title: 'Campaign Performance Drop',
          type: 'campaign_drop',
          severity: 'high',
          data: expect.objectContaining({
            event_type: 'campaign.performance_drop',
            campaign_name: 'Spring Sale',
          }),
        }),
      );
    });

    it('should mark event as processed after successful handling', async () => {
      const payload = createPayload();

      await handler.handle(TENANT_ID, payload, 'sha256=abc');

      await vi.waitFor(() => {
        expect(updateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'processed',
          }),
        );
      });
    });
  });

  describe('failed processing', () => {
    it('should mark event as failed in DB when processing throws', async () => {
      // Make push service throw
      mockSendToTenant.mockRejectedValueOnce(new Error('Push failed'));

      const payload = createPayload({ event_type: 'lead.scored' });

      await handler.handle(TENANT_ID, payload, 'sha256=abc');

      // The processEvent catch branch should mark the event as failed
      await vi.waitFor(() => {
        expect(updateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'failed',
            error: 'Push failed',
          }),
        );
      });
    });
  });

  describe('unknown event types', () => {
    it('should store but not send push for unknown event types', async () => {
      const payload = createPayload({ event_type: 'custom.unknown_event' });

      await handler.handle(TENANT_ID, payload, 'sha256=abc');

      await vi.waitFor(() => {
        expect(updateChain.set).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'processed',
          }),
        );
      });

      // PushService should NOT be called for unknown events
      expect(mockSendToTenant).not.toHaveBeenCalled();
    });
  });
});
