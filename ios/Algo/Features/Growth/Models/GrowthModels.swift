// GrowthModels.swift
// Algo
//
// Data models for Growth Copilot summary, channel scores,
// execution history, and safety status endpoints.

import Foundation

// MARK: - GrowthSummary

/// High-level growth summary for a given period.
/// Combines KPI changes, channel health scores, top recommendations,
/// and urgent action items into a single overview.
struct GrowthSummary: Codable, Sendable {

    /// The time period covered (e.g., "last_7_days", "last_30_days").
    let period: String

    /// AI-generated headline summarizing the growth state.
    let headline: String

    /// Key performance indicator changes for the period.
    let kpiChanges: [KpiChange]

    /// Health scores per marketing channel.
    let channelScores: [ChannelScore]

    /// Top AI-recommended actions for the period.
    let topRecommendations: [Recommendation]

    /// List of urgent items requiring immediate attention.
    let urgentItems: [String]
}

// MARK: - KpiChange

/// Represents a change in a single KPI metric over a period.
struct KpiChange: Codable, Identifiable, Sendable {

    var id: String { metric }

    /// The metric name (e.g., "leads", "revenue", "engagement").
    let metric: String

    /// Value at the start of the period.
    let previousValue: Double

    /// Value at the end of the period.
    let currentValue: Double

    /// Percentage change between previous and current values.
    let changePercent: Double

    /// Direction of change: "up" or "down".
    let direction: String

    /// Statistical significance: "low", "medium", "high", or "critical".
    let significance: String

    /// The period over which the change was measured.
    let period: String
}

// MARK: - ChannelScore

/// Health score for a single marketing channel.
struct ChannelScore: Codable, Identifiable, Sendable {

    var id: String { platform }

    /// Platform name (e.g., "whatsapp", "instagram", "email").
    let platform: String

    /// Engagement rate as a percentage (0.0 to 100.0).
    let engagementRate: Double

    /// Proxy metric for lead conversion effectiveness (0.0 to 100.0).
    let leadConversionProxy: Double

    /// Cost efficiency score (0.0 to 100.0).
    let costEfficiency: Double

    /// Composite overall score (0.0 to 100.0).
    let overallScore: Double

    /// Score trend: "improving", "stable", or "declining".
    let trend: String

    /// Optional AI recommendation for the channel.
    let recommendation: String?
}

// MARK: - ExecutionEntry

/// A record of a previously executed recommendation action.
struct ExecutionEntry: Codable, Identifiable, Sendable {

    /// Unique execution identifier.
    let id: String

    /// The recommendation that was executed.
    let recommendationId: String

    /// The type of action performed (e.g., "schedule_post", "send_followup").
    let actionType: String

    /// State snapshot before execution.
    let beforeState: [String: String]?

    /// State snapshot after execution.
    let afterState: [String: String]?

    /// Execution result: "success" or "failed".
    let result: String

    /// Error message if execution failed.
    let error: String?

    /// ISO 8601 timestamp of when the action was executed.
    let executedAt: String
}

// MARK: - ExecutionHistoryResponse

/// Response wrapper for the execution history endpoint.
/// Maps to GET `/recommendations/history`.
struct ExecutionHistoryResponse: Codable, Sendable {

    /// List of execution entries sorted by most recent first.
    let executions: [ExecutionEntry]
}

// MARK: - SafetyStatus

/// Current safety limiter status for automated actions.
/// Maps to GET `/recommendations/safety`.
struct SafetyStatus: Codable, Sendable {

    /// Number of actions executed in the current hour.
    let hourlyUsed: Int

    /// Number of actions executed today.
    let dailyUsed: Int

    /// The configured safety limits.
    let limits: SafetyLimits
}

// MARK: - SafetyLimits

/// Configured safety limits for automated action execution.
struct SafetyLimits: Codable, Sendable {

    /// Maximum actions allowed per hour.
    let maxActionsPerHour: Int

    /// Maximum actions allowed per day.
    let maxActionsPerDay: Int

    /// Whether user confirmation is required before execution.
    let requireConfirmation: Bool
}

// MARK: - CodingKeys

extension GrowthSummary {

    enum CodingKeys: String, CodingKey {
        case period
        case headline
        case kpiChanges = "kpi_changes"
        case channelScores = "channel_scores"
        case topRecommendations = "top_recommendations"
        case urgentItems = "urgent_items"
    }
}

extension KpiChange {

    enum CodingKeys: String, CodingKey {
        case metric
        case previousValue = "previous_value"
        case currentValue = "current_value"
        case changePercent = "change_percent"
        case direction
        case significance
        case period
    }
}

extension ChannelScore {

    enum CodingKeys: String, CodingKey {
        case platform
        case engagementRate = "engagement_rate"
        case leadConversionProxy = "lead_conversion_proxy"
        case costEfficiency = "cost_efficiency"
        case overallScore = "overall_score"
        case trend
        case recommendation
    }
}

extension ExecutionEntry {

    enum CodingKeys: String, CodingKey {
        case id
        case recommendationId = "recommendation_id"
        case actionType = "action_type"
        case beforeState = "before_state"
        case afterState = "after_state"
        case result
        case error
        case executedAt = "executed_at"
    }
}

extension SafetyStatus {

    enum CodingKeys: String, CodingKey {
        case hourlyUsed = "hourly_used"
        case dailyUsed = "daily_used"
        case limits
    }
}

extension SafetyLimits {

    enum CodingKeys: String, CodingKey {
        case maxActionsPerHour = "max_actions_per_hour"
        case maxActionsPerDay = "max_actions_per_day"
        case requireConfirmation = "require_confirmation"
    }
}
