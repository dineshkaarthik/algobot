// DashboardMetrics.swift
// Algo
//
// Data models for the dashboard summary endpoint.
// Maps to GET /dashboard/summary response from the Algo backend.

import Foundation

// MARK: - DashboardSummary

/// Top-level response from the `/dashboard/summary` endpoint.
/// Contains the current period's metrics and active alerts.
struct DashboardSummary: Codable, Sendable {

    /// The time period for the metrics (e.g., "today", "this_week").
    let period: String

    /// Aggregated business metrics for the period.
    let metrics: DashboardMetrics

    /// Active alerts requiring attention.
    let alerts: [AlertItem]

    /// ISO 8601 timestamp of the last data update.
    let updatedAt: String
}

// MARK: - DashboardMetrics

/// Aggregated business metrics displayed on the dashboard.
/// All numeric values represent the current period's totals.
struct DashboardMetrics: Codable, Sendable {

    /// Total number of leads across all sources.
    let totalLeads: Int

    /// Number of leads classified as "hot" (high engagement score).
    let hotLeads: Int

    /// Number of currently active marketing campaigns.
    let activeCampaigns: Int

    /// Total engagement count across all platforms (likes, comments, shares).
    let totalEngagement: Int

    /// Remaining AI processing credits for the billing period.
    let aiCreditsRemaining: Int

    /// Total AI credits allocated for the billing period.
    let aiCreditsTotal: Int

    /// Revenue generated during the current period.
    let revenueToday: Double

    /// Total value of leads in the sales pipeline.
    let pipelineValue: Double

    /// Number of follow-ups that are due or overdue.
    let pendingFollowups: Int
}

// MARK: - CodingKeys

extension DashboardSummary {

    enum CodingKeys: String, CodingKey {
        case period
        case metrics
        case alerts
        case updatedAt = "updated_at"
    }
}

extension DashboardMetrics {

    enum CodingKeys: String, CodingKey {
        case totalLeads = "total_leads"
        case hotLeads = "hot_leads"
        case activeCampaigns = "active_campaigns"
        case totalEngagement = "total_engagement"
        case aiCreditsRemaining = "ai_credits_remaining"
        case aiCreditsTotal = "ai_credits_total"
        case revenueToday = "revenue_today"
        case pipelineValue = "pipeline_value"
        case pendingFollowups = "pending_followups"
    }
}
