// Recommendation.swift
// Algo
//
// Data models for the Growth Copilot recommendations endpoints.
// Maps to GET /recommendations and related API responses.

import Foundation

// MARK: - Recommendation

/// A single AI-generated growth recommendation.
/// Maps to the `/recommendations` endpoint response items.
struct Recommendation: Codable, Identifiable, Sendable {

    /// Unique recommendation identifier.
    let id: String

    /// Recommendation type key (e.g., "schedule_post", "follow_up_lead").
    let type: String

    /// Human-readable recommendation title.
    let title: String

    /// Detailed description explaining the recommendation rationale.
    let description: String

    /// Confidence score from 0.0 to 1.0.
    let confidence: Double

    /// Expected impact level: "low", "medium", or "high".
    let impact: String

    /// Category of the recommendation: "growth", "optimization", "risk", or "opportunity".
    let category: String

    /// Whether this recommendation can be executed directly.
    let actionable: Bool

    /// The action to execute if the recommendation is accepted.
    let action: RecommendationAction?

    /// Current status: "pending", "accepted", "dismissed", "executed", or "expired".
    let status: String

    /// ISO 8601 timestamp when the recommendation was created.
    let createdAt: String

    /// ISO 8601 timestamp when the recommendation expires.
    let expiresAt: String
}

// MARK: - RecommendationAction

/// Describes the executable action for an actionable recommendation.
struct RecommendationAction: Codable, Sendable {

    /// The backend tool to invoke (e.g., "schedule_social_post").
    let tool: String

    /// Parameters for the tool invocation.
    let params: [String: String]?
}

// MARK: - RecommendationsResponse

/// Response wrapper for the recommendations list endpoint.
/// Maps to GET `/recommendations`.
struct RecommendationsResponse: Codable, Sendable {

    /// The list of recommendations.
    let recommendations: [Recommendation]

    /// Total number of recommendations matching the query.
    let total: Int
}

// MARK: - AcceptResponse

/// Response from accepting a recommendation.
/// Maps to POST `/recommendations/:id/accept`.
struct AcceptResponse: Codable, Sendable {

    /// The confirmation ID for tracking execution.
    let confirmationId: String

    /// Status of the acceptance (e.g., "accepted").
    let status: String
}

// MARK: - DismissResponse

/// Response from dismissing a recommendation.
/// Maps to POST `/recommendations/:id/dismiss`.
struct DismissResponse: Codable, Sendable {

    /// Status of the dismissal (e.g., "dismissed").
    let status: String
}

// MARK: - CodingKeys

extension Recommendation {

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case title
        case description
        case confidence
        case impact
        case category
        case actionable
        case action
        case status
        case createdAt = "created_at"
        case expiresAt = "expires_at"
    }
}

extension AcceptResponse {

    enum CodingKeys: String, CodingKey {
        case confirmationId = "confirmation_id"
        case status
    }
}
