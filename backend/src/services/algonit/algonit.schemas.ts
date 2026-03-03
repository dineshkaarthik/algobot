/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT API RESPONSE SCHEMAS (Zod)
 * ════════════════════════════════════════════════════════════
 *
 *  Runtime validation schemas matching every interface in
 *  algonit.types.ts. Matched against real Algonit API (2026-03-02).
 *
 *  Uses .passthrough() to allow extra fields from future
 *  Algonit API versions without breaking.
 *
 *  Exports a validateResponse<T> helper for graceful degradation:
 *  logs warnings on validation failure but returns data anyway.
 * ════════════════════════════════════════════════════════════
 */

import { z, type ZodType } from 'zod';
import { logger } from '../../utils/logger.js';

// ─── Shared Sub-Schemas ────────────────────────────────────

export const DateRangeSchema = z.object({
  from: z.string().nullable(),
  to: z.string().nullable(),
}).passthrough();

export const CreditTransactionSchema = z.object({
  type: z.string(),
  amount: z.number(),
  description: z.string(),
  createdAt: z.string(),
}).passthrough();

export const PostEntrySchema = z.object({
  id: z.number(),
  content: z.string(),
  platform: z.string(),
  status: z.string(),
  scheduledFor: z.string().nullable(),
  postType: z.string(),
  createdAt: z.string(),
}).passthrough();

export const PostsSummarySchema = z.object({
  total: z.number(),
  published: z.number(),
  scheduled: z.number(),
  draft: z.number(),
  failed: z.number(),
}).passthrough();

export const CampaignListEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  campaignType: z.string(),
  platforms: z.array(z.string()),
  status: z.string(),
  creationMode: z.string(),
  createdAt: z.string(),
  totalPosts: z.number(),
  publishedPosts: z.number(),
  scheduledPosts: z.number(),
  draftPosts: z.number(),
}).passthrough();

export const CampaignPerfRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  platforms: z.array(z.string()),
  goal: z.string(),
  totalPosts: z.number(),
  publishedPosts: z.number(),
  failedPosts: z.number(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
}).passthrough();

export const CampaignPerfTotalsSchema = z.object({
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  impressions: z.number(),
  reach: z.number(),
  totalEngagements: z.number(),
  ctr: z.number(),
  roi: z.number().nullable(),
  spend: z.number().nullable(),
  conversions: z.number().nullable(),
  note: z.string(),
}).passthrough();

export const EmailCampaignEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
  audienceSegment: z.string(),
  tone: z.string(),
  createdAt: z.string(),
  totalSubscribers: z.number(),
  activeSubscribers: z.number(),
  emailsSent: z.number(),
  emailsOpened: z.number(),
  emailsClicked: z.number(),
  openRate: z.string(),
}).passthrough();

export const MarketRadarSignalSchema = z.object({
  id: z.number(),
  signalType: z.string(),
  title: z.string(),
  summary: z.string(),
  importance: z.string(),
  sentiment: z.string(),
  actionableInsight: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
}).passthrough();

export const MarketRadarCompetitorsSchema = z.object({
  total: z.number(),
  names: z.array(z.string()),
}).passthrough();

export const MarketRadarSignalsSummarySchema = z.object({
  total: z.number(),
  unread: z.number(),
  high: z.number(),
  medium: z.number(),
  low: z.number(),
}).passthrough();

export const DashboardUserSchema = z.object({
  name: z.string(),
  company: z.string(),
}).passthrough();

export const HotLeadEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  jobTitle: z.string(),
  lifecycleStage: z.string(),
  leadScore: z.number(),
  isQualified: z.boolean(),
  budgetRange: z.string().nullable(),
  decisionTimeframe: z.string().nullable(),
  lastEngagementAt: z.string().nullable(),
  lastTouchType: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  createdAt: z.string(),
  fullName: z.string(),
  urgency: z.string(),
}).passthrough();

export const BuyingIntentSignalSchema = z.object({
  id: z.number(),
  platform: z.string(),
  signalType: z.string(),
  authorName: z.string().nullable(),
  authorUsername: z.string().nullable(),
  content: z.string(),
  sentiment: z.string(),
  intentScore: z.number(),
  intentSignals: z.array(z.string()),
  engagementScore: z.number(),
  status: z.string(),
  leadCaptured: z.boolean(),
  outreachTriggered: z.boolean(),
  contactId: z.number(),
  createdAt: z.string(),
  priority: z.string(),
  actionNeeded: z.boolean(),
}).passthrough();

export const FollowUpContactSchema = z.object({
  id: z.number(),
  name: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  jobTitle: z.string(),
  lifecycleStage: z.string(),
  leadScore: z.number(),
  lastEngagementAt: z.string().nullable(),
  lastTouchType: z.string().nullable(),
  decisionTimeframe: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  createdAt: z.string(),
  fullName: z.string(),
  daysSinceLastContact: z.number(),
  overdueSeverity: z.string(),
}).passthrough();

export const DealEntrySchema = z.object({
  id: z.number(),
  name: z.string(),
  company: z.string(),
  value: z.number(),
  stage: z.string(),
  weightedValue: z.number(),
  closeUrgency: z.string(),
  lastActivity: z.string(),
}).passthrough();

export const PlatformEngagementSchema = z.object({
  platform: z.string(),
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  impressions: z.number(),
  reach: z.number(),
  records: z.number(),
  totalEngagements: z.number(),
  avgCtr: z.number(),
}).passthrough();

export const EngagementTotalsSchema = z.object({
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  impressions: z.number(),
  reach: z.number(),
  totalEngagements: z.number(),
}).passthrough();

export const LeadEntrySchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  companyName: z.string(),
  jobTitle: z.string(),
  lifecycleStage: z.string(),
  leadScore: z.number(),
  isQualified: z.boolean(),
  source: z.string(),
  lastEngagementAt: z.string().nullable(),
  createdAt: z.string(),
  fullName: z.string(),
  isHot: z.boolean(),
}).passthrough();

export const CampaignActionRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  status: z.string(),
}).passthrough();

export const ContentTypePerformanceSchema = z.object({
  platform: z.string(),
  contentType: z.string(),
  postCount: z.number(),
  avgEngagement: z.number(),
  avgLikes: z.number(),
  avgComments: z.number(),
  avgShares: z.number(),
  avgImpressions: z.number(),
  totalEngagement: z.number(),
}).passthrough();

export const TopPostSchema = z.object({
  id: z.number(),
  platform: z.string(),
  contentType: z.string(),
  preview: z.string(),
  likes: z.number(),
  comments: z.number(),
  shares: z.number(),
  impressions: z.number(),
  totalEngagement: z.number(),
  publishedAt: z.string(),
}).passthrough();

export const InsightsPeriodSchema = z.object({
  from: z.string(),
  to: z.string(),
  days: z.number(),
}).passthrough();

// ─── Query Response Schemas ──────────────────────────────────

/** GET /api/algo/me */
export const ProfileResponseSchema = z.object({
  user: z.object({
    id: z.number(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    company: z.string(),
    jobTitle: z.string(),
  }).passthrough(),
}).passthrough();

/** GET /api/algo/credits */
export const CreditsBalanceResponseSchema = z.object({
  balance: z.number(),
  planCredits: z.number(),
  topUpCredits: z.number(),
  monthlyAllocation: z.number(),
  totalSpent: z.number(),
  recentTransactions: z.array(CreditTransactionSchema),
}).passthrough();

/** GET /api/algo/posts */
export const PostsResponseSchema = z.object({
  posts: z.array(PostEntrySchema),
  summary: PostsSummarySchema,
}).passthrough();

/** GET /api/algo/campaigns */
export const CampaignListResponseSchema = z.object({
  campaigns: z.array(CampaignListEntrySchema),
}).passthrough();

/** GET /api/algo/campaigns/:id/performance */
export const CampaignPerformanceResponseSchema = z.object({
  campaign: CampaignPerfRefSchema,
  dateRange: DateRangeSchema,
  totals: CampaignPerfTotalsSchema,
  byPlatform: z.array(z.record(z.unknown())),
}).passthrough();

/** GET /api/algo/email-campaigns */
export const EmailCampaignStatsResponseSchema = z.object({
  campaigns: z.array(EmailCampaignEntrySchema),
}).passthrough();

/** GET /api/algo/market-radar/summary */
export const MarketRadarResponseSchema = z.object({
  competitors: MarketRadarCompetitorsSchema,
  signals: MarketRadarSignalsSummarySchema,
  recentSignals: z.array(MarketRadarSignalSchema),
}).passthrough();

/** GET /api/algo/summary */
export const DashboardSummaryResponseSchema = z.object({
  user: DashboardUserSchema,
  credits: z.object({ balance: z.number() }).passthrough(),
  posts: z.object({
    recent: z.number(),
    published: z.number(),
    scheduled: z.number(),
    failed: z.number(),
  }).passthrough(),
  campaigns: z.object({ active: z.number() }).passthrough(),
  marketRadar: z.object({
    unreadSignals: z.number(),
    highPriorityUnread: z.number(),
  }).passthrough(),
}).passthrough();

/** GET /api/algo/hot-leads */
export const HotLeadsResponseSchema = z.object({
  total: z.number(),
  minScoreFilter: z.number(),
  hotLeads: z.array(HotLeadEntrySchema),
}).passthrough();

/** GET /api/algo/buying-intent */
export const BuyingIntentResponseSchema = z.object({
  total: z.number(),
  minIntentFilter: z.number(),
  byPlatform: z.record(z.string(), z.number()),
  signals: z.array(BuyingIntentSignalSchema),
}).passthrough();

/** GET /api/algo/follow-ups */
export const FollowUpsResponseSchema = z.object({
  total: z.number(),
  staleDaysFilter: z.number(),
  followUps: z.array(FollowUpContactSchema),
}).passthrough();

/** GET /api/algo/deals */
export const DealsResponseSchema = z.object({
  deals: z.array(DealEntrySchema),
  total: z.number(),
  totalPipelineValue: z.number(),
  currency: z.string(),
  byStage: z.record(z.string(), z.number()),
}).passthrough();

/** GET /api/algo/engagement */
export const SocialEngagementResponseSchema = z.object({
  dateRange: DateRangeSchema,
  platformFilter: z.string(),
  overall: EngagementTotalsSchema,
  byPlatform: z.array(PlatformEngagementSchema),
  totalRecords: z.number(),
}).passthrough();

/** GET /api/algo/leads */
export const LeadsResponseSchema = z.object({
  leads: z.array(LeadEntrySchema),
  total: z.number(),
  qualified: z.number(),
  unqualified: z.number(),
  avgLeadScore: z.number(),
  dateRange: DateRangeSchema,
  filters: z.object({ source: z.string(), stage: z.string() }).passthrough(),
  byStage: z.record(z.string(), z.number()),
  bySource: z.record(z.string(), z.number()),
}).passthrough();

/** GET /api/algo/insights */
export const InsightsResponseSchema = z.object({
  period: InsightsPeriodSchema,
  insights: z.array(z.string()),
  byContentType: z.array(ContentTypePerformanceSchema),
  topPosts: z.array(TopPostSchema),
  campaignPerformanceByPlatform: z.array(z.record(z.unknown())),
}).passthrough();

/** Daily metric snapshot sub-schema */
export const MetricSnapshotSchema = z.object({
  date: z.string(),
  platform: z.string(),
  pageId: z.string().nullable().optional(),
  pageName: z.string().nullable().optional(),
  followers: z.number(),
  reach: z.number(),
  impressions: z.number(),
  engagement: z.number(),
  likes: z.number().optional().default(0),
  comments: z.number().optional().default(0),
  shares: z.number().optional().default(0),
}).passthrough();

/** GET /api/algo/metrics */
export const MetricsResponseSchema = z.object({
  metrics: z.array(MetricSnapshotSchema),
  dateRange: DateRangeSchema.optional(),
  filters: z.object({
    platform: z.string().nullable().optional(),
    pageId: z.string().nullable().optional(),
    days: z.number().optional(),
  }).passthrough().optional(),
}).passthrough();

/** Growth entry sub-schema */
const GrowthPeriodSchema = z.object({
  change: z.number().optional(),
  percent: z.number(),
}).passthrough();

export const GrowthEntrySchema = z.object({
  platform: z.string(),
  pageId: z.string().nullable().optional(),
  pageName: z.string().nullable().optional(),
  followers: z.object({
    current: z.number(),
    '7d': GrowthPeriodSchema.optional(),
    '30d': GrowthPeriodSchema.optional(),
  }).passthrough(),
  reach: z.object({
    '7d': z.object({ percent: z.number() }).passthrough().optional(),
    '30d': z.object({ percent: z.number() }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough();

/** GET /api/algo/metrics/growth */
export const MetricsGrowthResponseSchema = z.object({
  growth: z.array(GrowthEntrySchema),
  dataQuality: z.object({
    completeness: z.number().optional(),
    lastUpdated: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

// ─── Action Response Schemas ─────────────────────────────────

export const PauseCampaignResponseSchema = z.object({
  success: z.boolean(),
  campaign: CampaignActionRefSchema,
  message: z.string(),
}).passthrough();

export const ResumeCampaignResponseSchema = z.object({
  success: z.boolean(),
  campaign: CampaignActionRefSchema,
  message: z.string(),
}).passthrough();

// Deferred (mock-only) schemas — lightweight, for dev mode validation

export const CreateCampaignResponseSchema = z.object({
  success: z.boolean(),
  campaign: z.object({ id: z.string(), name: z.string(), platform: z.string(), type: z.string(), status: z.string(), created_at: z.string() }).passthrough(),
  message: z.string(),
}).passthrough();

export const GenerateContentResponseSchema = z.object({
  success: z.boolean(),
  content: z.object({ platform: z.string(), topic: z.string(), tone: z.string(), generated_text: z.string(), hashtags: z.array(z.string()), estimated_reach: z.number() }).passthrough(),
  credits_used: z.number(),
}).passthrough();

export const TriggerFollowupResponseSchema = z.object({
  success: z.boolean(),
  followup: z.object({ lead_id: z.string(), method: z.string(), status: z.string(), scheduled_at: z.string() }).passthrough(),
  message: z.string(),
}).passthrough();

export const AssignTaskResponseSchema = z.object({
  success: z.boolean(),
  task: z.object({ id: z.string(), assignee_id: z.string(), assignee_name: z.string(), type: z.string(), description: z.string(), lead_id: z.string().optional(), status: z.string(), created_at: z.string() }).passthrough(),
  message: z.string(),
}).passthrough();

export const GenerateReportResponseSchema = z.object({
  success: z.boolean(),
  report: z.object({ id: z.string(), type: z.string(), period: z.object({ from: z.string(), to: z.string() }).passthrough(), status: z.string(), download_url: z.string() }).passthrough(),
  message: z.string(),
}).passthrough();

// ─── Validation Helper ─────────────────────────────────────

/**
 * Validates raw API response data against a Zod schema.
 *
 * Graceful degradation strategy:
 *  - On success: returns the parsed, typed data.
 *  - On failure: logs a warning with validation errors, then returns
 *    the raw data cast to T so the app continues working even if the
 *    Algonit API shape changes unexpectedly.
 */
export function validateResponse<T>(
  schema: ZodType<T>,
  data: unknown,
  label?: string,
): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const tag = label || 'AlgonitResponse';
  logger.warn(
    {
      schema: tag,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    },
    `Algonit response validation warning for ${tag} — returning raw data with graceful degradation`,
  );

  return data as T;
}
