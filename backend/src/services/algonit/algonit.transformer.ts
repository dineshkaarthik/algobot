/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT RESPONSE TRANSFORMER
 * ════════════════════════════════════════════════════════════
 *
 *  Transforms raw Algonit API responses into typed, normalized
 *  objects. Each method follows the same pipeline:
 *
 *    1. Validate with Zod schema (graceful degradation)
 *    2. Normalize nulls to sensible defaults
 *    3. Normalize date strings to Date objects where appropriate
 *    4. Return fully typed result
 *
 *  All methods are static — no instance state needed.
 * ════════════════════════════════════════════════════════════
 */

import { validateResponse } from './algonit.schemas.js';
import {
  ProfileResponseSchema,
  CreditsBalanceResponseSchema,
  PostsResponseSchema,
  CampaignListResponseSchema,
  CampaignPerformanceResponseSchema,
  EmailCampaignStatsResponseSchema,
  MarketRadarResponseSchema,
  DashboardSummaryResponseSchema,
  HotLeadsResponseSchema,
  BuyingIntentResponseSchema,
  FollowUpsResponseSchema,
  DealsResponseSchema,
  SocialEngagementResponseSchema,
  LeadsResponseSchema,
  PauseCampaignResponseSchema,
  ResumeCampaignResponseSchema,
  InsightsResponseSchema,
} from './algonit.schemas.js';

import type {
  ProfileResponse,
  CreditsBalanceResponse,
  PostsResponse,
  CampaignListResponse,
  CampaignPerformanceResponse,
  EmailCampaignStatsResponse,
  MarketRadarResponse,
  DashboardSummaryResponse,
  HotLeadsResponse,
  BuyingIntentResponse,
  FollowUpsResponse,
  DealsResponse,
  SocialEngagementResponse,
  LeadsResponse,
  PauseCampaignResponse,
  ResumeCampaignResponse,
  InsightsResponse,
} from './algonit.types.js';

// ─── ISO 8601 date pattern ─────────────────────────────────

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

export class AlgonitTransformer {
  // ─── Generic Utilities ─────────────────────────────────

  static normalizeDates<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
        const parsed = new Date(value);
        result[key] = isNaN(parsed.getTime()) ? value : parsed;
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item !== null && typeof item === 'object' && !Array.isArray(item)
            ? AlgonitTransformer.normalizeDates(item as Record<string, unknown>)
            : item,
        );
      } else if (value !== null && typeof value === 'object') {
        result[key] = AlgonitTransformer.normalizeDates(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  static normalizeNulls<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        result[key] = '';
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item !== null && typeof item === 'object' && !Array.isArray(item)
            ? AlgonitTransformer.normalizeNulls(item as Record<string, unknown>)
            : item === null || item === undefined
              ? ''
              : item,
        );
      } else if (typeof value === 'object') {
        result[key] = AlgonitTransformer.normalizeNulls(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  // ─── Query Transformers ──────────────────────────────────

  static transformProfile(raw: unknown): ProfileResponse {
    return this.validate(ProfileResponseSchema, raw, 'Profile');
  }

  static transformCreditsBalance(raw: unknown): CreditsBalanceResponse {
    return this.validate(CreditsBalanceResponseSchema, raw, 'CreditsBalance');
  }

  static transformPosts(raw: unknown): PostsResponse {
    return this.validate(PostsResponseSchema, raw, 'Posts');
  }

  static transformCampaignList(raw: unknown): CampaignListResponse {
    return this.validate(CampaignListResponseSchema, raw, 'CampaignList');
  }

  static transformCampaignPerformance(raw: unknown): CampaignPerformanceResponse {
    return this.validate(CampaignPerformanceResponseSchema, raw, 'CampaignPerformance');
  }

  static transformEmailCampaigns(raw: unknown): EmailCampaignStatsResponse {
    return this.validate(EmailCampaignStatsResponseSchema, raw, 'EmailCampaigns');
  }

  static transformMarketRadar(raw: unknown): MarketRadarResponse {
    return this.validate(MarketRadarResponseSchema, raw, 'MarketRadar');
  }

  static transformDashboardSummary(raw: unknown): DashboardSummaryResponse {
    return this.validate(DashboardSummaryResponseSchema, raw, 'DashboardSummary');
  }

  static transformHotLeads(raw: unknown): HotLeadsResponse {
    return this.validate(HotLeadsResponseSchema, raw, 'HotLeads');
  }

  static transformBuyingIntent(raw: unknown): BuyingIntentResponse {
    return this.validate(BuyingIntentResponseSchema, raw, 'BuyingIntent');
  }

  static transformFollowUps(raw: unknown): FollowUpsResponse {
    return this.validate(FollowUpsResponseSchema, raw, 'FollowUps');
  }

  static transformDeals(raw: unknown): DealsResponse {
    return this.validate(DealsResponseSchema, raw, 'Deals');
  }

  static transformSocialEngagement(raw: unknown): SocialEngagementResponse {
    return this.validate(SocialEngagementResponseSchema, raw, 'SocialEngagement');
  }

  static transformLeads(raw: unknown): LeadsResponse {
    return this.validate(LeadsResponseSchema, raw, 'Leads');
  }

  static transformInsights(raw: unknown): InsightsResponse {
    return this.validate(InsightsResponseSchema, raw, 'Insights');
  }

  // ─── Action Transformers ─────────────────────────────────

  static transformPauseCampaign(raw: unknown): PauseCampaignResponse {
    return this.validate(PauseCampaignResponseSchema, raw, 'PauseCampaign');
  }

  static transformResumeCampaign(raw: unknown): ResumeCampaignResponse {
    return this.validate(ResumeCampaignResponseSchema, raw, 'ResumeCampaign');
  }

  // ─── Private ─────────────────────────────────────────────

  private static validate<T>(schema: any, raw: unknown, label: string): T {
    const validated = validateResponse<T>(schema, raw, label);
    const normalized = AlgonitTransformer.normalizeNulls(
      validated as unknown as Record<string, unknown>,
    );
    return normalized as unknown as T;
  }
}
