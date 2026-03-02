/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT API CLIENT
 * ════════════════════════════════════════════════════════════
 *
 *  Secure middleware layer between Algo and Algonit platform APIs.
 *  Each instance is scoped to a single tenant.
 *
 *  In development mode, returns realistic mock data.
 *  In production, proxies to actual Algonit REST APIs through
 *  a full resilience pipeline:
 *
 *    method call → mock check → cache.get() → resilience.execute(
 *      tokenStore.getAccessToken() → fetch with Bearer token
 *      → classifyError on failure
 *    ) → validateResponse (Zod) → cache.set() → return typed result
 *
 *  All endpoints use Algonit's /api/algo/* routes.
 * ════════════════════════════════════════════════════════════
 */

import { getEnv } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AlgonitTokenStore } from './algonit.token.store.js';
import { AlgonitResilience } from './algonit.resilience.js';
import { AlgonitCache } from './algonit.cache.js';
import { classifyError } from './algonit.errors.js';
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
  CreateCampaignResponseSchema,
  GenerateContentResponseSchema,
  TriggerFollowupResponseSchema,
  AssignTaskResponseSchema,
  GenerateReportResponseSchema,
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
  CreateCampaignResponse,
  GenerateContentResponse,
  TriggerFollowupResponse,
  AssignTaskResponse,
  GenerateReportResponse,
  InsightsResponse,
} from './algonit.types.js';
import type { ZodType } from 'zod';

// ─── Shared Singletons ──────────────────────────────────────

let tokenStore: AlgonitTokenStore | null = null;
let resilience: AlgonitResilience | null = null;
let cache: AlgonitCache | null = null;

function getTokenStore(): AlgonitTokenStore {
  return (tokenStore ??= new AlgonitTokenStore());
}
function getResilience(): AlgonitResilience {
  return (resilience ??= new AlgonitResilience());
}
function getCache(): AlgonitCache {
  return (cache ??= new AlgonitCache());
}

/** Reset singletons — intended for testing only. */
export function _resetSingletons(): void {
  tokenStore = null;
  resilience = null;
  cache = null;
}

// ─── Client ─────────────────────────────────────────────────

export class AlgonitClient {
  private baseUrl: string;
  private useMocks: boolean;
  private tenantId: string;

  constructor(tenantId: string) {
    const env = getEnv();
    this.baseUrl = env.ALGONIT_API_URL;
    this.useMocks = env.NODE_ENV === 'development';
    this.tenantId = tenantId;
  }

  // ─── Query Methods (Live endpoints) ─────────────────────

  /** GET /api/algo/me */
  async getProfile(): Promise<ProfileResponse> {
    if (this.useMocks) {
      return {
        user: {
          id: 4,
          email: 'user@example.com',
          firstName: 'Demo',
          lastName: 'User',
          company: 'Demo Corp',
          jobTitle: 'CEO',
        },
      };
    }

    return this.request<ProfileResponse>(
      'GET', '/me', {},
      ProfileResponseSchema, 'Profile',
    );
  }

  /** GET /api/algo/credits */
  async getCreditsBalance(): Promise<CreditsBalanceResponse> {
    if (this.useMocks) {
      return {
        balance: 4500,
        planCredits: 3000,
        topUpCredits: 1500,
        monthlyAllocation: 5000,
        totalSpent: -5500,
        recentTransactions: [
          { type: 'usage', amount: -50, description: 'Content Generation', createdAt: '2026-03-01T14:00:00Z' },
          { type: 'usage', amount: -30, description: 'Chatbot Response', createdAt: '2026-03-01T12:00:00Z' },
          { type: 'usage', amount: -20, description: 'Lead Scoring', createdAt: '2026-02-28T16:00:00Z' },
          { type: 'purchase', amount: 5000, description: 'Credit Top-up', createdAt: '2026-02-15T10:00:00Z' },
          { type: 'usage', amount: -40, description: 'Email Drafting', createdAt: '2026-02-14T09:00:00Z' },
        ],
      };
    }

    return this.request<CreditsBalanceResponse>(
      'GET', '/credits', {},
      CreditsBalanceResponseSchema, 'CreditsBalance',
    );
  }

  /** GET /api/algo/posts */
  async getPosts(status?: string, platform?: string): Promise<PostsResponse> {
    if (this.useMocks) {
      return {
        posts: [
          { id: 101, content: 'Exciting product launch coming next week!', platform: 'instagram', status: 'published', scheduledFor: null, postType: 'image', createdAt: '2026-03-01T10:00:00Z' },
          { id: 102, content: 'B2B strategies that work in 2026', platform: 'linkedin', status: 'published', scheduledFor: null, postType: 'article', createdAt: '2026-02-28T14:00:00Z' },
          { id: 103, content: 'Weekend sale starts Friday!', platform: 'facebook', status: 'scheduled', scheduledFor: '2026-03-07T09:00:00Z', postType: 'image', createdAt: '2026-02-27T09:00:00Z' },
        ],
        summary: {
          total: 3,
          published: 2,
          scheduled: 1,
          draft: 0,
          failed: 0,
        },
      };
    }

    return this.request<PostsResponse>(
      'GET', '/posts', { status, platform },
      PostsResponseSchema, 'Posts',
    );
  }

  /** GET /api/algo/campaigns */
  async listCampaigns(status?: string, platform?: string): Promise<CampaignListResponse> {
    if (this.useMocks) {
      return {
        campaigns: [
          { id: 23, name: 'Spring Sale', campaignType: 'social', platforms: ['instagram', 'facebook'], status: 'active', creationMode: 'ai_generated', createdAt: '2026-02-15T00:00:00Z', totalPosts: 12, publishedPosts: 8, scheduledPosts: 4, draftPosts: 0 },
          { id: 24, name: 'Q1 Product Launch', campaignType: 'social', platforms: ['facebook'], status: 'active', creationMode: 'manual', createdAt: '2026-01-10T00:00:00Z', totalPosts: 8, publishedPosts: 6, scheduledPosts: 2, draftPosts: 0 },
          { id: 25, name: 'B2B Thought Leadership', campaignType: 'social', platforms: ['linkedin'], status: 'active', creationMode: 'ai_generated', createdAt: '2026-02-01T00:00:00Z', totalPosts: 15, publishedPosts: 10, scheduledPosts: 3, draftPosts: 2 },
          { id: 26, name: 'Onboarding Drip', campaignType: 'email', platforms: ['email'], status: 'active', creationMode: 'manual', createdAt: '2026-01-20T00:00:00Z', totalPosts: 5, publishedPosts: 3, scheduledPosts: 2, draftPosts: 0 },
          { id: 27, name: 'Winter Clearance', campaignType: 'social', platforms: ['instagram'], status: 'completed', creationMode: 'ai_generated', createdAt: '2025-12-01T00:00:00Z', totalPosts: 20, publishedPosts: 20, scheduledPosts: 0, draftPosts: 0 },
        ],
      };
    }

    return this.request<CampaignListResponse>(
      'GET', '/campaigns', { status, platform },
      CampaignListResponseSchema, 'CampaignList',
    );
  }

  /** GET /api/algo/campaigns/:id/performance */
  async getCampaignPerformance(campaignId: string): Promise<CampaignPerformanceResponse> {
    if (this.useMocks) {
      return {
        campaign: {
          id: Number(campaignId) || 23,
          name: 'Spring Sale',
          status: 'active',
          platforms: ['instagram', 'facebook'],
          goal: 'brand_awareness',
          totalPosts: 12,
          publishedPosts: 8,
          failedPosts: 0,
          startDate: '2026-02-15',
          endDate: null,
        },
        dateRange: { from: null, to: null },
        totals: {
          likes: 1450,
          comments: 234,
          shares: 89,
          impressions: 18500,
          reach: 12000,
          totalEngagements: 1773,
          ctr: 8.9,
          roi: 3.2,
          spend: 450.0,
          conversions: 98,
          note: 'Performance data aggregated from all connected platforms.',
        },
        byPlatform: [
          { platform: 'instagram', likes: 980, comments: 156, shares: 45, impressions: 11200, reach: 7800 },
          { platform: 'facebook', likes: 470, comments: 78, shares: 44, impressions: 7300, reach: 4200 },
        ],
      };
    }

    return this.request<CampaignPerformanceResponse>(
      'GET', `/campaigns/${campaignId}/performance`, {},
      CampaignPerformanceResponseSchema, 'CampaignPerformance',
    );
  }

  /** GET /api/algo/email-campaigns */
  async getEmailCampaigns(): Promise<EmailCampaignStatsResponse> {
    if (this.useMocks) {
      return {
        campaigns: [
          { id: 10, name: 'Onboarding Drip', status: 'active', audienceSegment: 'new_users', tone: 'friendly', createdAt: '2026-01-20T00:00:00Z', totalSubscribers: 1200, activeSubscribers: 1050, emailsSent: 3600, emailsOpened: 1440, emailsClicked: 468, openRate: '40.0%' },
          { id: 11, name: 'Newsletter March', status: 'active', audienceSegment: 'all_subscribers', tone: 'professional', createdAt: '2026-03-01T00:00:00Z', totalSubscribers: 5000, activeSubscribers: 4200, emailsSent: 5000, emailsOpened: 1750, emailsClicked: 420, openRate: '35.0%' },
          { id: 12, name: 'Re-engagement', status: 'paused', audienceSegment: 'inactive_30d', tone: 'casual', createdAt: '2026-02-10T00:00:00Z', totalSubscribers: 800, activeSubscribers: 320, emailsSent: 800, emailsOpened: 240, emailsClicked: 72, openRate: '30.0%' },
        ],
      };
    }

    return this.request<EmailCampaignStatsResponse>(
      'GET', '/email-campaigns', {},
      EmailCampaignStatsResponseSchema, 'EmailCampaigns',
    );
  }

  /** GET /api/algo/market-radar/summary */
  async getMarketRadar(): Promise<MarketRadarResponse> {
    if (this.useMocks) {
      return {
        competitors: { total: 3, names: ['CompetitorX', 'RivalCo', 'MarketLeader'] },
        signals: { total: 8, unread: 3, high: 2, medium: 4, low: 2 },
        recentSignals: [
          { id: 1, signalType: 'pricing_change', title: 'CompetitorX Price Drop', summary: 'CompetitorX reduced pricing by 15% on their business plan', importance: 'high', sentiment: 'negative', actionableInsight: 'Consider adjusting your pricing strategy to remain competitive', isRead: false, createdAt: '2026-03-01T08:00:00Z' },
          { id: 2, signalType: 'new_feature', title: 'RivalCo AI Composer', summary: 'RivalCo launched AI-powered email composer', importance: 'medium', sentiment: 'neutral', actionableInsight: 'Evaluate your email automation capabilities vs. this new offering', isRead: false, createdAt: '2026-02-28T12:00:00Z' },
          { id: 3, signalType: 'campaign_launch', title: 'MarketLeader LinkedIn Push', summary: 'MarketLeader started aggressive LinkedIn ad campaign', importance: 'low', sentiment: 'neutral', actionableInsight: 'Monitor LinkedIn ad space for potential cost increases', isRead: true, createdAt: '2026-02-27T15:00:00Z' },
        ],
      };
    }

    return this.request<MarketRadarResponse>(
      'GET', '/market-radar/summary', {},
      MarketRadarResponseSchema, 'MarketRadar',
    );
  }

  /** GET /api/algo/summary */
  async getDashboardSummary(): Promise<DashboardSummaryResponse> {
    if (this.useMocks) {
      return {
        user: { name: 'Demo User', company: 'Demo Corp' },
        credits: { balance: 4500 },
        posts: { recent: 12, published: 8, scheduled: 4, failed: 0 },
        campaigns: { active: 4 },
        marketRadar: { unreadSignals: 3, highPriorityUnread: 1 },
      };
    }

    return this.request<DashboardSummaryResponse>(
      'GET', '/summary', {},
      DashboardSummaryResponseSchema, 'DashboardSummary',
    );
  }

  /** GET /api/algo/hot-leads */
  async getHotLeads(): Promise<HotLeadsResponse> {
    if (this.useMocks) {
      return {
        total: 5,
        minScoreFilter: 70,
        hotLeads: [
          { id: 1, name: 'Sarah', lastName: 'Johnson', email: 'sarah@techcorp.com', phone: '+1234567890', companyName: 'TechCorp', jobTitle: 'CTO', lifecycleStage: 'opportunity', leadScore: 92, isQualified: true, budgetRange: '$50k-100k', decisionTimeframe: '30 days', lastEngagementAt: '2026-03-01T14:20:00Z', lastTouchType: 'email_open', linkedinUrl: null, createdAt: '2026-02-01T10:00:00Z', fullName: 'Sarah Johnson', urgency: 'high' },
          { id: 2, name: 'Mike', lastName: 'Chen', email: 'mike@growthio.com', phone: null, companyName: 'GrowthIO', jobTitle: 'VP Marketing', lifecycleStage: 'qualified', leadScore: 85, isQualified: true, budgetRange: '$20k-50k', decisionTimeframe: '60 days', lastEngagementAt: '2026-03-01T11:45:00Z', lastTouchType: 'website_visit', linkedinUrl: 'https://linkedin.com/in/mikechen', createdAt: '2026-02-05T08:00:00Z', fullName: 'Mike Chen', urgency: 'medium' },
          { id: 3, name: 'Lisa', lastName: 'Park', email: 'lisa@scaleup.com', phone: null, companyName: 'ScaleUp Inc', jobTitle: 'Marketing Director', lifecycleStage: 'qualified', leadScore: 78, isQualified: true, budgetRange: null, decisionTimeframe: '90 days', lastEngagementAt: '2026-02-28T16:30:00Z', lastTouchType: 'email_click', linkedinUrl: null, createdAt: '2026-02-10T12:00:00Z', fullName: 'Lisa Park', urgency: 'medium' },
          { id: 4, name: 'James', lastName: 'Wilson', email: 'james@dataflow.io', phone: '+1987654321', companyName: 'DataFlow', jobTitle: 'Head of Growth', lifecycleStage: 'lead', leadScore: 74, isQualified: true, budgetRange: null, decisionTimeframe: null, lastEngagementAt: '2026-02-27T09:15:00Z', lastTouchType: 'social_engagement', linkedinUrl: null, createdAt: '2026-02-15T14:00:00Z', fullName: 'James Wilson', urgency: 'low' },
          { id: 5, name: 'Amy', lastName: 'Rodriguez', email: 'amy@cloudnine.co', phone: null, companyName: 'CloudNine', jobTitle: 'CEO', lifecycleStage: 'lead', leadScore: 71, isQualified: true, budgetRange: null, decisionTimeframe: null, lastEngagementAt: '2026-02-26T13:00:00Z', lastTouchType: 'referral', linkedinUrl: 'https://linkedin.com/in/amyrodriguez', createdAt: '2026-02-20T09:00:00Z', fullName: 'Amy Rodriguez', urgency: 'low' },
        ],
      };
    }

    return this.request<HotLeadsResponse>(
      'GET', '/hot-leads', {},
      HotLeadsResponseSchema, 'HotLeads',
    );
  }

  /** GET /api/algo/buying-intent */
  async getBuyingIntent(): Promise<BuyingIntentResponse> {
    if (this.useMocks) {
      return {
        total: 3,
        minIntentFilter: 50,
        byPlatform: { linkedin: 1, twitter: 1, facebook: 1 },
        signals: [
          { id: 1, platform: 'linkedin', signalType: 'content_engagement', authorName: 'Sarah Johnson', authorUsername: 'sarahjohnson', content: 'Liked 3 pricing page posts and downloaded whitepaper', sentiment: 'positive', intentScore: 85, intentSignals: ['pricing_interest', 'content_download', 'repeated_visits'], engagementScore: 92, status: 'active', leadCaptured: true, outreachTriggered: false, contactId: 1, createdAt: '2026-03-01T10:00:00Z', priority: 'high', actionNeeded: true },
          { id: 2, platform: 'twitter', signalType: 'mention', authorName: 'Tom Davis', authorUsername: 'tomdavis', content: 'Asked about marketing automation tools for SMBs', sentiment: 'neutral', intentScore: 72, intentSignals: ['direct_inquiry', 'tool_comparison'], engagementScore: 65, status: 'active', leadCaptured: false, outreachTriggered: false, contactId: 6, createdAt: '2026-02-28T14:30:00Z', priority: 'medium', actionNeeded: true },
          { id: 3, platform: 'facebook', signalType: 'competitor_mention', authorName: 'Nina Patel', authorUsername: null, content: 'Shared competitor comparison post with positive comments about our features', sentiment: 'positive', intentScore: 58, intentSignals: ['competitor_comparison', 'positive_mention'], engagementScore: 45, status: 'active', leadCaptured: true, outreachTriggered: false, contactId: 7, createdAt: '2026-02-27T11:00:00Z', priority: 'low', actionNeeded: false },
        ],
      };
    }

    return this.request<BuyingIntentResponse>(
      'GET', '/buying-intent', {},
      BuyingIntentResponseSchema, 'BuyingIntent',
    );
  }

  /** GET /api/algo/follow-ups */
  async getFollowUps(): Promise<FollowUpsResponse> {
    if (this.useMocks) {
      return {
        total: 3,
        staleDaysFilter: 3,
        followUps: [
          { id: 1, name: 'Sarah', lastName: 'Johnson', email: 'sarah@techcorp.com', phone: '+1234567890', companyName: 'TechCorp', jobTitle: 'CTO', lifecycleStage: 'opportunity', leadScore: 92, lastEngagementAt: '2026-02-25T14:00:00Z', lastTouchType: 'email_open', decisionTimeframe: '30 days', linkedinUrl: null, createdAt: '2026-02-01T10:00:00Z', fullName: 'Sarah Johnson', daysSinceLastContact: 5, overdueSeverity: 'high' },
          { id: 3, name: 'Lisa', lastName: 'Park', email: 'lisa@scaleup.com', phone: null, companyName: 'ScaleUp Inc', jobTitle: 'Marketing Director', lifecycleStage: 'qualified', leadScore: 78, lastEngagementAt: '2026-02-22T10:00:00Z', lastTouchType: 'email_click', decisionTimeframe: '90 days', linkedinUrl: null, createdAt: '2026-02-10T12:00:00Z', fullName: 'Lisa Park', daysSinceLastContact: 8, overdueSeverity: 'high' },
          { id: 4, name: 'James', lastName: 'Wilson', email: 'james@dataflow.io', phone: '+1987654321', companyName: 'DataFlow', jobTitle: 'Head of Growth', lifecycleStage: 'lead', leadScore: 74, lastEngagementAt: '2026-02-20T16:00:00Z', lastTouchType: 'social_engagement', decisionTimeframe: null, linkedinUrl: null, createdAt: '2026-02-15T14:00:00Z', fullName: 'James Wilson', daysSinceLastContact: 10, overdueSeverity: 'medium' },
        ],
      };
    }

    return this.request<FollowUpsResponse>(
      'GET', '/follow-ups', {},
      FollowUpsResponseSchema, 'FollowUps',
    );
  }

  /** GET /api/algo/deals */
  async getDeals(): Promise<DealsResponse> {
    if (this.useMocks) {
      return {
        deals: [
          { id: 1, name: 'TechCorp Enterprise', company: 'TechCorp', value: 45000, stage: 'negotiation', weightedValue: 31500, closeUrgency: 'high', lastActivity: '2026-03-01T14:00:00Z' },
          { id: 2, name: 'GrowthIO Platform', company: 'GrowthIO', value: 28000, stage: 'proposal', weightedValue: 14000, closeUrgency: 'medium', lastActivity: '2026-02-28T11:00:00Z' },
          { id: 3, name: 'ScaleUp Pilot', company: 'ScaleUp Inc', value: 15000, stage: 'qualification', weightedValue: 4500, closeUrgency: 'low', lastActivity: '2026-02-27T09:00:00Z' },
          { id: 4, name: 'DataFlow Integration', company: 'DataFlow', value: 32000, stage: 'proposal', weightedValue: 16000, closeUrgency: 'medium', lastActivity: '2026-02-26T15:00:00Z' },
          { id: 5, name: 'CloudNine Expansion', company: 'CloudNine', value: 69000, stage: 'closed_won', weightedValue: 69000, closeUrgency: 'none', lastActivity: '2026-02-25T10:00:00Z' },
        ],
        total: 5,
        totalPipelineValue: 189000,
        currency: 'USD',
        byStage: { negotiation: 1, proposal: 2, qualification: 1, closed_won: 1 },
      };
    }

    return this.request<DealsResponse>(
      'GET', '/deals', {},
      DealsResponseSchema, 'Deals',
    );
  }

  /** GET /api/algo/engagement */
  async getSocialEngagement(platform?: string): Promise<SocialEngagementResponse> {
    if (this.useMocks) {
      return {
        dateRange: { from: null, to: null },
        platformFilter: platform || 'all',
        overall: {
          likes: 2894,
          comments: 302,
          shares: 641,
          impressions: 53930,
          reach: 36400,
          totalEngagements: 3837,
        },
        byPlatform: [
          { platform: 'instagram', likes: 1203, comments: 89, shares: 45, impressions: 18500, reach: 12000, records: 15, totalEngagements: 1337, avgCtr: 7.2 },
          { platform: 'facebook', likes: 890, comments: 67, shares: 456, impressions: 15200, reach: 9800, records: 12, totalEngagements: 1413, avgCtr: 5.8 },
          { platform: 'twitter', likes: 234, comments: 12, shares: 51, impressions: 8700, reach: 6200, records: 8, totalEngagements: 297, avgCtr: 3.4 },
          { platform: 'linkedin', likes: 567, comments: 134, shares: 89, impressions: 11530, reach: 8400, records: 10, totalEngagements: 790, avgCtr: 6.9 },
        ],
        totalRecords: 45,
      };
    }

    return this.request<SocialEngagementResponse>(
      'GET', '/engagement', { platform },
      SocialEngagementResponseSchema, 'SocialEngagement',
    );
  }

  /** GET /api/algo/leads */
  async getLeads(source?: string, stage?: string): Promise<LeadsResponse> {
    if (this.useMocks) {
      return {
        leads: [
          { id: 1, firstName: 'Sarah', lastName: 'Johnson', email: 'sarah@techcorp.com', companyName: 'TechCorp', jobTitle: 'CTO', lifecycleStage: 'opportunity', leadScore: 92, isQualified: true, source: 'linkedin', lastEngagementAt: '2026-03-01T14:20:00Z', createdAt: '2026-02-01T10:00:00Z', fullName: 'Sarah Johnson', isHot: true },
          { id: 2, firstName: 'Mike', lastName: 'Chen', email: 'mike@growthio.com', companyName: 'GrowthIO', jobTitle: 'VP Marketing', lifecycleStage: 'qualified', leadScore: 85, isQualified: true, source: 'website', lastEngagementAt: '2026-03-01T11:45:00Z', createdAt: '2026-02-05T08:00:00Z', fullName: 'Mike Chen', isHot: true },
          { id: 3, firstName: 'Lisa', lastName: 'Park', email: 'lisa@scaleup.com', companyName: 'ScaleUp Inc', jobTitle: 'Marketing Director', lifecycleStage: 'qualified', leadScore: 78, isQualified: true, source: 'email', lastEngagementAt: '2026-02-28T16:30:00Z', createdAt: '2026-02-10T12:00:00Z', fullName: 'Lisa Park', isHot: true },
          { id: 8, firstName: 'David', lastName: 'Kim', email: 'david@byteforce.com', companyName: 'ByteForce', jobTitle: 'Manager', lifecycleStage: 'lead', leadScore: 45, isQualified: false, source: 'social', lastEngagementAt: '2026-02-27T10:00:00Z', createdAt: '2026-02-15T14:00:00Z', fullName: 'David Kim', isHot: false },
          { id: 9, firstName: 'Emily', lastName: 'Brown', email: 'emily@pixelco.com', companyName: 'PixelCo', jobTitle: 'Analyst', lifecycleStage: 'subscriber', leadScore: 32, isQualified: false, source: 'website', lastEngagementAt: null, createdAt: '2026-02-20T09:00:00Z', fullName: 'Emily Brown', isHot: false },
        ],
        total: 47,
        qualified: 30,
        unqualified: 17,
        avgLeadScore: 58.3,
        dateRange: { from: null, to: null },
        filters: { source: source || 'all', stage: stage || 'all' },
        byStage: { subscriber: 5, lead: 10, qualified: 12, opportunity: 8, customer: 7, evangelist: 5 },
        bySource: { social: 18, email: 12, website: 9, whatsapp: 5, referral: 3 },
      };
    }

    return this.request<LeadsResponse>(
      'GET', '/leads', { source, stage },
      LeadsResponseSchema, 'Leads',
    );
  }

  /** GET /api/algo/insights */
  async getInsights(dateFrom?: string, dateTo?: string, platform?: string): Promise<InsightsResponse> {
    if (this.useMocks) {
      return {
        period: { from: dateFrom || '2026-02-01', to: dateTo || '2026-03-01', days: 28 },
        insights: [
          'On instagram, reels outperform image posts by 3.2x in average engagement (248.0 vs 77.5)',
          'Your best performing post this month was a reel on instagram with 379 total engagements',
          'LinkedIn articles generate 2.1x more comments than regular posts',
          'Facebook engagement is down 15% compared to last month — consider refreshing your content strategy',
          'Posts published between 10am-12pm consistently get 40% more engagement than evening posts',
        ],
        byContentType: [
          { platform: 'instagram', contentType: 'reels', postCount: 12, avgEngagement: 248.0, avgLikes: 210.5, avgComments: 28.2, avgShares: 9.3, avgImpressions: 1420.0, totalEngagement: 2976 },
          { platform: 'instagram', contentType: 'image', postCount: 8, avgEngagement: 77.5, avgLikes: 62.0, avgComments: 10.5, avgShares: 5.0, avgImpressions: 680.0, totalEngagement: 620 },
          { platform: 'linkedin', contentType: 'article', postCount: 6, avgEngagement: 134.0, avgLikes: 89.0, avgComments: 32.0, avgShares: 13.0, avgImpressions: 1100.0, totalEngagement: 804 },
        ],
        topPosts: [
          { id: 42, platform: 'instagram', contentType: 'reels', preview: 'Summer sale is here...', likes: 312, comments: 48, shares: 19, impressions: 2800, totalEngagement: 379, publishedAt: '2026-02-18T10:30:00Z' },
          { id: 38, platform: 'linkedin', contentType: 'article', preview: '5 ways AI is changing marketing...', likes: 156, comments: 67, shares: 28, impressions: 1900, totalEngagement: 251, publishedAt: '2026-02-22T09:00:00Z' },
        ],
        campaignPerformanceByPlatform: [
          { platform: 'instagram', campaigns: 3, totalEngagement: 4200, avgROI: 2.8 },
          { platform: 'linkedin', campaigns: 2, totalEngagement: 1600, avgROI: 3.1 },
          { platform: 'facebook', campaigns: 2, totalEngagement: 980, avgROI: 1.4 },
        ],
      };
    }

    return this.request<InsightsResponse>(
      'GET', '/insights',
      { date_from: dateFrom, date_to: dateTo, platform },
      InsightsResponseSchema, 'Insights',
    );
  }

  // ─── Action Methods (Live) ────────────────────────────────

  /** PATCH /api/algo/campaigns/:id — pause */
  async pauseCampaign(campaignId: string): Promise<PauseCampaignResponse> {
    if (this.useMocks) {
      return {
        success: true,
        campaign: { id: Number(campaignId) || 23, name: 'Spring Sale', status: 'paused' },
        message: 'Campaign paused successfully',
      };
    }

    return this.request<PauseCampaignResponse>(
      'PATCH', `/campaigns/${campaignId}`,
      { status: 'paused' },
      PauseCampaignResponseSchema, 'PauseCampaign',
    );
  }

  /** PATCH /api/algo/campaigns/:id — resume */
  async resumeCampaign(campaignId: string): Promise<ResumeCampaignResponse> {
    if (this.useMocks) {
      return {
        success: true,
        campaign: { id: Number(campaignId) || 23, name: 'Spring Sale', status: 'active' },
        message: 'Campaign resumed successfully',
      };
    }

    return this.request<ResumeCampaignResponse>(
      'PATCH', `/campaigns/${campaignId}`,
      { status: 'active' },
      ResumeCampaignResponseSchema, 'ResumeCampaign',
    );
  }

  // ─── Deferred Action Methods (Mock-only, next phase) ──────

  async createCampaign(data: Record<string, unknown>): Promise<CreateCampaignResponse> {
    // Always mock — no Algonit endpoint yet
    return {
      success: true,
      campaign: {
        id: `cmp_${Date.now()}`,
        name: data.name as string,
        platform: data.platform as string,
        type: data.type as string,
        status: 'draft',
        created_at: new Date().toISOString(),
      },
      message: 'Campaign created successfully (mock)',
    };
  }

  async generateContent(platform: string, topic: string, tone?: string): Promise<GenerateContentResponse> {
    const toneLabel = tone || 'professional';
    return {
      success: true,
      content: {
        platform,
        topic,
        tone: toneLabel,
        generated_text: `Exciting news about ${topic}! We've been working hard to bring you the best solutions for your business growth.\n\nKey highlights:\n- Proven ROI improvements\n- Streamlined automation\n- Data-driven insights\n\nReady to take your business to the next level? Let's talk!`,
        hashtags: ['#BusinessGrowth', '#Innovation', '#Marketing'],
        estimated_reach: 5000,
      },
      credits_used: 5,
    };
  }

  async triggerFollowup(leadId: string, method?: string): Promise<TriggerFollowupResponse> {
    return {
      success: true,
      followup: {
        lead_id: leadId,
        method: method || 'email',
        status: 'triggered',
        scheduled_at: new Date().toISOString(),
      },
      message: 'Follow-up triggered successfully (mock)',
    };
  }

  async assignTask(assigneeId: string, taskType: string, description: string, leadId?: string): Promise<AssignTaskResponse> {
    return {
      success: true,
      task: {
        id: `task_${Date.now()}`,
        assignee_id: assigneeId,
        assignee_name: 'Team Member',
        type: taskType,
        description,
        lead_id: leadId,
        status: 'assigned',
        created_at: new Date().toISOString(),
      },
      message: 'Task assigned successfully (mock)',
    };
  }

  async generateReport(reportType: string, dateFrom: string, dateTo: string): Promise<GenerateReportResponse> {
    return {
      success: true,
      report: {
        id: `rpt_${Date.now()}`,
        type: reportType,
        period: { from: dateFrom, to: dateTo },
        status: 'generated',
        download_url: `https://reports.algonit.com/rpt_${Date.now()}.pdf`,
      },
      message: 'Report generated successfully (mock)',
    };
  }

  // ─── HTTP Client (Production Pipeline) ─────────────────

  /**
   * Production request pipeline:
   *  1. Check cache (GET only)
   *  2. Execute through resilience layer (circuit breaker + retry + timeout)
   *     a. Get per-tenant API token
   *     b. Make authenticated HTTP request
   *     c. Classify errors for resilience decisions
   *  3. Validate response with Zod schema (graceful degradation)
   *  4. Cache response (GET) or invalidate related caches (write operations)
   *  5. Return typed result
   */
  private async request<T>(
    method: string,
    endpoint: string,
    params: Record<string, unknown>,
    schema: ZodType<T>,
    label: string,
  ): Promise<T> {
    // 1. Check cache for GET requests
    if (method === 'GET') {
      const cached = await getCache().get<T>(this.tenantId, endpoint, params);
      if (cached) {
        logger.debug({ tenantId: this.tenantId, endpoint, label }, 'Algonit cache hit');
        return cached;
      }
    }

    // 2. Execute through resilience pipeline
    const result = await getResilience().execute<T>(this.tenantId, async (signal) => {
      // 2a. Get per-tenant API token
      const token = await getTokenStore().getAccessToken(this.tenantId);

      // 2b. Build URL and make authenticated request
      const url = this.buildUrl(method, endpoint, params);

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: method !== 'GET' ? JSON.stringify(this.stripUndefined(params)) : undefined,
        signal,
      });

      // 2c. Classify HTTP errors
      if (!response.ok) {
        throw classifyError(
          new Error(`HTTP ${response.status} ${response.statusText}`),
          response.status,
          response.headers,
        );
      }

      const data = await response.json();

      // 3. Validate response with Zod schema (graceful degradation)
      return validateResponse<T>(schema, data, label);
    });

    // 4. Cache management
    if (method === 'GET') {
      await getCache().set(this.tenantId, endpoint, params, result);
    } else {
      await getCache().invalidate(this.tenantId, method, endpoint);
    }

    // 5. Return typed result
    return result;
  }

  // ─── URL Builder ───────────────────────────────────────

  private buildUrl(method: string, endpoint: string, params: Record<string, unknown>): string {
    const base = `${this.baseUrl}${endpoint}`;

    if (method !== 'GET') {
      return base;
    }

    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `${base}?${queryString}` : base;
  }

  private stripUndefined(params: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    }
    return result;
  }
}
