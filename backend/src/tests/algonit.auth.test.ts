import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlgonitAuth } from '../services/algonit/algonit.auth.js';
import { AlgonitAuthError } from '../services/algonit/algonit.errors.js';

// ─── Mocks ────────────────────────────────────────────────

const TEST_ENV = {
  ALGONIT_API_URL: 'https://algonit.com/api/algo',
};

vi.mock('../config/env.js', () => ({
  getEnv: () => TEST_ENV,
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Tests ────────────────────────────────────────────────

describe('AlgonitAuth', () => {
  let auth: AlgonitAuth;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auth = new AlgonitAuth();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ─── verifyToken ─────────────────────────────────────────

  describe('verifyToken', () => {
    const mockProfile = {
      id: 'usr_123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'admin',
      organization: {
        id: 'org_abc',
        name: 'Test Corp',
        plan: 'business',
      },
    };

    it('should verify a valid token by calling /me', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProfile),
      });

      const result = await auth.verifyToken('valid-api-token');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://algonit.com/api/algo/me');
      expect(options.headers.Authorization).toBe('Bearer valid-api-token');

      expect(result.valid).toBe(true);
      expect(result.algonit_org_id).toBe('org_abc');
      expect(result.algonit_org_name).toBe('Test Corp');
      expect(result.algonit_user_id).toBe('usr_123');
      expect(result.algonit_user_name).toBe('Test User');
    });

    it('should throw AlgonitAuthError for invalid token', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(auth.verifyToken('invalid-token')).rejects.toThrow(AlgonitAuthError);
      await expect(auth.verifyToken('invalid-token')).rejects.toThrow(
        'Invalid Algonit API token',
      );
    });

    it('should throw on network error', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(auth.verifyToken('token')).rejects.toThrow(TypeError);
    });
  });

  // ─── revokeToken ─────────────────────────────────────────

  describe('revokeToken', () => {
    it('should call DELETE /auth/tokens/:id when tokenId is provided', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true });

      await auth.revokeToken('api-token', 'token-id-123');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://algonit.com/api/algo/auth/tokens/token-id-123');
      expect(options.method).toBe('DELETE');
      expect(options.headers.Authorization).toBe('Bearer api-token');
    });

    it('should skip revocation when no tokenId is provided', async () => {
      await auth.revokeToken('api-token');

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should not throw on failed revocation (best-effort)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(auth.revokeToken('token', 'id')).resolves.toBeUndefined();
    });
  });
});
