/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT AUTH — API Token Management
 * ════════════════════════════════════════════════════════════
 *
 *  Algonit uses simple Bearer token auth. Tenants connect by
 *  providing an API token (created via Algonit dashboard or
 *  POST /api/algo/auth/tokens).
 *
 *  No OAuth flow needed — tokens don't expire unless revoked.
 * ════════════════════════════════════════════════════════════
 */

import { getEnv } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AlgonitAuthError } from './algonit.errors.js';

export class AlgonitAuth {
  private algonitBaseUrl: string;

  constructor() {
    this.algonitBaseUrl = getEnv().ALGONIT_API_URL;
  }

  /**
   * Verify an API token by calling GET /api/algo/me
   * Returns the user profile if valid, throws if not.
   */
  async verifyToken(apiToken: string): Promise<AlgonitTokenInfo> {
    const response = await fetch(`${this.algonitBaseUrl}/me`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!response.ok) {
      throw new AlgonitAuthError('Invalid Algonit API token');
    }

    const profile = await response.json() as any;
    return {
      valid: true,
      algonit_org_id: profile.organization?.id,
      algonit_org_name: profile.organization?.name,
      algonit_user_id: profile.id,
      algonit_user_name: profile.name,
    };
  }

  /**
   * Revoke an API token at Algonit (best effort).
   * Uses DELETE /api/algo/auth/tokens/:id if we have the token ID.
   */
  async revokeToken(apiToken: string, tokenId?: string): Promise<void> {
    if (!tokenId) {
      logger.debug('No token ID available for revocation — skipping');
      return;
    }

    try {
      await fetch(`${this.algonitBaseUrl}/auth/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to revoke Algonit token (best effort)');
    }
  }
}

export interface AlgonitTokenInfo {
  valid: boolean;
  algonit_org_id: string;
  algonit_org_name: string;
  algonit_user_id: string;
  algonit_user_name: string;
}
