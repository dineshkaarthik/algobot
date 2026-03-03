/**
 * ════════════════════════════════════════════════════════════
 *  ALGONIT API RESPONSE TYPES
 * ════════════════════════════════════════════════════════════
 *
 *  Typed interfaces for all Algonit /api/algo/* endpoints.
 *  Matched against real Algonit API responses (2026-03-02).
 *
 *  Grouped:
 *    - Shared sub-types
 *    - Query response types (16 endpoints)
 *    - Action response types (2 live + 5 deferred mock-only)
 * ════════════════════════════════════════════════════════════
 */

// ─── Shared Sub-Types ──────────────────────────────────────

export interface DateRange {
  from: string | null;
  to: string | null;
}

/** Credit transaction entry */
export interface CreditTransaction {
  type: string;
  amount: number;
  description: string;
  createdAt: string;
}

/** Social media post */
export interface PostEntry {
  id: number;
  content: string;
  platform: string;
  status: string;
  scheduledFor: string | null;
  postType: string;
  createdAt: string;
}

/** Posts summary stats */
export interface PostsSummary {
  total: number;
  published: number;
  scheduled: number;
  draft: number;
  failed: number;
}

/** Campaign listing entry */
export interface CampaignListEntry {
  id: number;
  name: string;
  campaignType: string;
  platforms: string[];
  status: string;
  creationMode: string;
  createdAt: string;
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
}

/** Campaign reference in performance response */
export interface CampaignPerfRef {
  id: number;
  name: string;
  status: string;
  platforms: string[];
  goal: string;
  totalPosts: number;
  publishedPosts: number;
  failedPosts: number;
  startDate: string | null;
  endDate: string | null;
}

/** Campaign performance totals */
export interface CampaignPerfTotals {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  totalEngagements: number;
  ctr: number;
  roi: number | null;
  spend: number | null;
  conversions: number | null;
  note: string;
}

/** Email DRIP campaign entry */
export interface EmailCampaignEntry {
  id: number;
  name: string;
  status: string;
  audienceSegment: string;
  tone: string;
  createdAt: string;
  totalSubscribers: number;
  activeSubscribers: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  openRate: string;
}

/** Market radar recent signal */
export interface MarketRadarSignal {
  id: number;
  signalType: string;
  title: string;
  summary: string;
  importance: string;
  sentiment: string;
  actionableInsight: string;
  isRead: boolean;
  createdAt: string;
}

/** Market radar competitors summary */
export interface MarketRadarCompetitors {
  total: number;
  names: string[];
}

/** Market radar signals summary */
export interface MarketRadarSignalsSummary {
  total: number;
  unread: number;
  high: number;
  medium: number;
  low: number;
}

/** Dashboard user info */
export interface DashboardUser {
  name: string;
  company: string;
}

/** Hot lead entry */
export interface HotLeadEntry {
  id: number;
  name: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string;
  lifecycleStage: string;
  leadScore: number;
  isQualified: boolean;
  budgetRange: string | null;
  decisionTimeframe: string | null;
  lastEngagementAt: string | null;
  lastTouchType: string | null;
  linkedinUrl: string | null;
  createdAt: string;
  fullName: string;
  urgency: string;
}

/** Buying intent signal */
export interface BuyingIntentSignal {
  id: number;
  platform: string;
  signalType: string;
  authorName: string | null;
  authorUsername: string | null;
  content: string;
  sentiment: string;
  intentScore: number;
  intentSignals: string[];
  engagementScore: number;
  status: string;
  leadCaptured: boolean;
  outreachTriggered: boolean;
  contactId: number;
  createdAt: string;
  priority: string;
  actionNeeded: boolean;
}

/** Follow-up contact entry */
export interface FollowUpContact {
  id: number;
  name: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string;
  lifecycleStage: string;
  leadScore: number;
  lastEngagementAt: string | null;
  lastTouchType: string | null;
  decisionTimeframe: string | null;
  linkedinUrl: string | null;
  createdAt: string;
  fullName: string;
  daysSinceLastContact: number;
  overdueSeverity: string;
}

/** Pipeline deal entry */
export interface DealEntry {
  id: number;
  name: string;
  company: string;
  value: number;
  stage: string;
  weightedValue: number;
  closeUrgency: string;
  lastActivity: string;
}

/** Per-platform engagement breakdown */
export interface PlatformEngagement {
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  records: number;
  totalEngagements: number;
  avgCtr: number;
}

/** Overall engagement totals */
export interface EngagementTotals {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  totalEngagements: number;
}

/** Lead entry */
export interface LeadEntry {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  companyName: string;
  jobTitle: string;
  lifecycleStage: string;
  leadScore: number;
  isQualified: boolean;
  source: string;
  lastEngagementAt: string | null;
  createdAt: string;
  fullName: string;
  isHot: boolean;
}

/** Campaign action ref (pause/resume response) */
export interface CampaignActionRef {
  id: number;
  name: string;
  status: string;
}

/** Content type performance breakdown (from insights endpoint) */
export interface ContentTypePerformance {
  platform: string;
  contentType: string;
  postCount: number;
  avgEngagement: number;
  avgLikes: number;
  avgComments: number;
  avgShares: number;
  avgImpressions: number;
  totalEngagement: number;
}

/** Top-performing post (from insights endpoint) */
export interface TopPost {
  id: number;
  platform: string;
  contentType: string;
  preview: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  totalEngagement: number;
  publishedAt: string;
}

/** Insights period metadata */
export interface InsightsPeriod {
  from: string;
  to: string;
  days: number;
}

// ─── Query Response Types (16 endpoints) ─────────────────────

/** GET /api/algo/me */
export interface ProfileResponse {
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    company: string;
    jobTitle: string;
  };
}

/** GET /api/algo/credits */
export interface CreditsBalanceResponse {
  balance: number;
  planCredits: number;
  topUpCredits: number;
  monthlyAllocation: number;
  totalSpent: number;
  recentTransactions: CreditTransaction[];
}

/** GET /api/algo/posts */
export interface PostsResponse {
  posts: PostEntry[];
  summary: PostsSummary;
}

/** GET /api/algo/campaigns */
export interface CampaignListResponse {
  campaigns: CampaignListEntry[];
}

/** GET /api/algo/campaigns/:id/performance */
export interface CampaignPerformanceResponse {
  campaign: CampaignPerfRef;
  dateRange: DateRange;
  totals: CampaignPerfTotals;
  byPlatform: Record<string, unknown>[];
}

/** GET /api/algo/email-campaigns */
export interface EmailCampaignStatsResponse {
  campaigns: EmailCampaignEntry[];
}

/** GET /api/algo/market-radar/summary */
export interface MarketRadarResponse {
  competitors: MarketRadarCompetitors;
  signals: MarketRadarSignalsSummary;
  recentSignals: MarketRadarSignal[];
}

/** GET /api/algo/summary */
export interface DashboardSummaryResponse {
  user: DashboardUser;
  credits: { balance: number };
  posts: { recent: number; published: number; scheduled: number; failed: number };
  campaigns: { active: number };
  marketRadar: { unreadSignals: number; highPriorityUnread: number };
}

/** GET /api/algo/hot-leads */
export interface HotLeadsResponse {
  total: number;
  minScoreFilter: number;
  hotLeads: HotLeadEntry[];
}

/** GET /api/algo/buying-intent */
export interface BuyingIntentResponse {
  total: number;
  minIntentFilter: number;
  byPlatform: Record<string, number>;
  signals: BuyingIntentSignal[];
}

/** GET /api/algo/follow-ups */
export interface FollowUpsResponse {
  total: number;
  staleDaysFilter: number;
  followUps: FollowUpContact[];
}

/** GET /api/algo/deals */
export interface DealsResponse {
  deals: DealEntry[];
  total: number;
  totalPipelineValue: number;
  currency: string;
  byStage: Record<string, number>;
}

/** GET /api/algo/engagement */
export interface SocialEngagementResponse {
  dateRange: DateRange;
  platformFilter: string;
  overall: EngagementTotals;
  byPlatform: PlatformEngagement[];
  totalRecords: number;
}

/** GET /api/algo/leads */
export interface LeadsResponse {
  leads: LeadEntry[];
  total: number;
  qualified: number;
  unqualified: number;
  avgLeadScore: number;
  dateRange: DateRange;
  filters: { source: string; stage: string };
  byStage: Record<string, number>;
  bySource: Record<string, number>;
}

/** GET /api/algo/insights */
export interface InsightsResponse {
  period: InsightsPeriod;
  insights: string[];
  byContentType: ContentTypePerformance[];
  topPosts: TopPost[];
  campaignPerformanceByPlatform: Record<string, unknown>[];
}

/** Daily metric snapshot (from /metrics endpoint) */
export interface MetricSnapshot {
  date: string;
  platform: string;
  pageId?: string | null;
  pageName?: string | null;
  followers: number;
  reach: number;
  impressions: number;
  engagement: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

/** GET /api/algo/metrics */
export interface MetricsResponse {
  metrics: MetricSnapshot[];
  dateRange?: DateRange;
  filters?: {
    platform?: string | null;
    pageId?: string | null;
    days?: number;
  };
}

/** Follower growth data per page/platform */
export interface GrowthEntry {
  platform: string;
  pageId?: string | null;
  pageName?: string | null;
  followers: {
    current: number;
    '7d'?: { change?: number; percent: number };
    '30d'?: { change?: number; percent: number };
  };
  reach?: {
    '7d'?: { percent: number };
    '30d'?: { percent: number };
  };
}

/** GET /api/algo/metrics/growth */
export interface MetricsGrowthResponse {
  growth: GrowthEntry[];
  dataQuality?: {
    completeness?: number;
    lastUpdated?: string;
  };
}

// ─── Action Response Types ───────────────────────────────────

/** PATCH /api/algo/campaigns/:id (pause) */
export interface PauseCampaignResponse {
  success: boolean;
  campaign: CampaignActionRef;
  message: string;
}

/** PATCH /api/algo/campaigns/:id (resume) */
export interface ResumeCampaignResponse {
  success: boolean;
  campaign: CampaignActionRef;
  message: string;
}

// ─── Deferred Action Response Types (mock-only, next phase) ──

export interface CreateCampaignResponse {
  success: boolean;
  campaign: { id: string; name: string; platform: string; type: string; status: string; created_at: string };
  message: string;
}

export interface GenerateContentResponse {
  success: boolean;
  content: { platform: string; topic: string; tone: string; generated_text: string; hashtags: string[]; estimated_reach: number };
  credits_used: number;
}

export interface TriggerFollowupResponse {
  success: boolean;
  followup: { lead_id: string; method: string; status: string; scheduled_at: string };
  message: string;
}

export interface AssignTaskResponse {
  success: boolean;
  task: { id: string; assignee_id: string; assignee_name: string; type: string; description: string; lead_id?: string; status: string; created_at: string };
  message: string;
}

export interface GenerateReportResponse {
  success: boolean;
  report: { id: string; type: string; period: { from: string; to: string }; status: string; download_url: string };
  message: string;
}

// ─── Union Types ───────────────────────────────────────────

export type AlgonitQueryResponse =
  | ProfileResponse
  | CreditsBalanceResponse
  | PostsResponse
  | CampaignListResponse
  | CampaignPerformanceResponse
  | EmailCampaignStatsResponse
  | MarketRadarResponse
  | DashboardSummaryResponse
  | HotLeadsResponse
  | BuyingIntentResponse
  | FollowUpsResponse
  | DealsResponse
  | SocialEngagementResponse
  | LeadsResponse
  | InsightsResponse
  | MetricsResponse
  | MetricsGrowthResponse;

export type AlgonitActionResponse =
  | PauseCampaignResponse
  | ResumeCampaignResponse
  | CreateCampaignResponse
  | GenerateContentResponse
  | TriggerFollowupResponse
  | AssignTaskResponse
  | GenerateReportResponse;

export type AlgonitResponse = AlgonitQueryResponse | AlgonitActionResponse;
