/**
 * ════════════════════════════════════════════════════════════
 *  PROACTIVE GROWTH ENGINE TYPES
 * ════════════════════════════════════════════════════════════
 *
 *  Types for the AI Growth Copilot: KPI monitoring, channel
 *  analysis, recommendations, safety guardrails, and
 *  execution logging.
 * ════════════════════════════════════════════════════════════
 */

import type { AlgonitToolName } from '../services/ai/tools.js';

// ─── KPI Monitoring ──────────────────────────────────────

export interface KpiMetrics {
  totalLeads: number;
  hotLeads: number;
  totalEngagement: number;
  emailOpenRate: number;
  creditBalance: number;
  activeCampaigns: number;
  followupsPending: number;
  revenue: number;
}

export interface KpiSnapshot {
  id: string;
  tenantId: string;
  metrics: KpiMetrics;
  capturedAt: Date;
}

export interface KpiChange {
  metric: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  direction: 'up' | 'down';
  significance: 'low' | 'medium' | 'high' | 'critical';
  period: string;
}

// ─── Recommendations ─────────────────────────────────────

export type RecommendationType =
  | 'pause_underperformer'
  | 'boost_top_performer'
  | 'content_type_shift'
  | 'lead_followup_urgent'
  | 'platform_rebalance'
  | 'credit_conservation'
  | 'engagement_recovery'
  | 'followup_backlog_clear';

export interface Recommendation {
  id: string;
  tenantId: string;
  type: RecommendationType;
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  category: 'growth' | 'optimization' | 'risk' | 'opportunity';
  actionable: boolean;
  action?: {
    toolName: AlgonitToolName;
    params: Record<string, unknown>;
    requiresConfirmation: true;
  };
  dataPoints: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'dismissed' | 'executed' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

// ─── Channel Analysis ────────────────────────────────────

export interface ChannelScore {
  platform: string;
  engagementRate: number;
  leadConversionProxy: number;
  costEfficiency: number;
  overallScore: number;
  trend: 'improving' | 'stable' | 'declining';
  recommendation?: string;
}

// ─── Growth Summary ──────────────────────────────────────

export interface GrowthSummary {
  period: string;
  headline: string;
  kpiChanges: KpiChange[];
  topRecommendations: Recommendation[];
  channelScores: ChannelScore[];
  urgentItems: string[];
}

// ─── Safety Guardrails ───────────────────────────────────

export interface SafetyLimits {
  maxActionsPerHour: number;
  maxActionsPerDay: number;
  requireConfirmation: boolean;
  blockedActions: string[];
}

// ─── Execution Log ───────────────────────────────────────

export interface ExecutionLogEntry {
  id: string;
  tenantId: string;
  recommendationId: string;
  userId: string;
  actionType: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  result: 'success' | 'failed' | 'rolled_back';
  error?: string;
  executedAt: Date;
}

// ─── Recommendation Rule Engine ──────────────────────────

export interface RecommendationRuleData {
  kpiChanges: KpiChange[];
  channelScores: ChannelScore[];
  hotLeads: any;
  followUps: any;
  campaigns: any;
  insights: any;
  credits: any;
}

export interface RecommendationRule {
  type: RecommendationType;
  check: (data: RecommendationRuleData) => Omit<Recommendation, 'id' | 'tenantId' | 'status' | 'createdAt' | 'expiresAt'>[];
}
