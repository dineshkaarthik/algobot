// ChatResponse.swift
// Algo
//
// API response models for the chat endpoints, matching the backend API contract.
// Includes request models for sending messages and confirming actions.

import Foundation

// MARK: - ChatAPIResponse

/// Response from POST /chat/message — the full response envelope.
struct ChatAPIResponse: Codable, Sendable {

    let conversationId: String
    let messageId: String
    let response: ChatResponseBody
    let intent: IntentInfo?
    let reasoningSummary: String?
    let tokenBudget: TokenBudgetInfo?
    let timestamp: String

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case messageId = "message_id"
        case response
        case intent
        case reasoningSummary = "reasoning_summary"
        case tokenBudget = "token_budget"
        case timestamp
    }
}

// MARK: - ChatAPIResponse Convenience

extension ChatAPIResponse {

    /// Converts the API response into a `Message` model for display.
    func toMessage() -> Message {
        Message(
            id: messageId,
            role: .assistant,
            content: response.text,
            structuredData: response.structuredData,
            suggestedActions: response.suggestedActions,
            intent: intent?.classifiedAs,
            requiresConfirmation: response.requiresConfirmation,
            confirmationId: response.confirmationId,
            timestamp: parsedTimestamp
        )
    }

    /// Parses the ISO 8601 timestamp string into a `Date`.
    var parsedTimestamp: Date {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: timestamp) ?? Date()
    }
}

// MARK: - ChatResponseBody

/// The inner response body containing the assistant's reply content.
struct ChatResponseBody: Codable, Sendable {

    let text: String
    let structuredData: StructuredData?
    let suggestedActions: [SuggestedAction]?
    let requiresConfirmation: Bool
    let confirmationId: String?

    enum CodingKeys: String, CodingKey {
        case text
        case structuredData = "structured_data"
        case suggestedActions = "suggested_actions"
        case requiresConfirmation = "requires_confirmation"
        case confirmationId = "confirmation_id"
    }
}

// MARK: - IntentInfo

/// Classification result from the AI intent classifier.
struct IntentInfo: Codable, Sendable, Equatable {

    let classifiedAs: String
    let confidence: Double

    enum CodingKeys: String, CodingKey {
        case classifiedAs = "classified_as"
        case confidence
    }

    /// Whether the classification confidence meets the high-confidence threshold.
    var isHighConfidence: Bool {
        confidence >= 0.85
    }
}

// MARK: - TokenBudgetInfo

/// Token budget status included in chat responses for usage tracking.
struct TokenBudgetInfo: Codable, Sendable, Equatable {

    let remaining: Int
    let percentUsed: Int

    enum CodingKeys: String, CodingKey {
        case remaining
        case percentUsed = "percent_used"
    }

    /// Whether the budget is running low (>80% used).
    var isLow: Bool {
        percentUsed > 80
    }

    /// Whether the budget is critically low (>95% used).
    var isCritical: Bool {
        percentUsed > 95
    }
}

// MARK: - ChatRequest

/// Request body for POST /chat/message.
struct ChatRequest: Codable, Sendable {

    let conversationId: String?
    let message: String
    let inputType: String
    let audioUrl: String?
    let context: ChatContext?

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case message
        case inputType = "input_type"
        case audioUrl = "audio_url"
        case context
    }

    init(
        conversationId: String? = nil,
        message: String,
        inputType: String = "text",
        audioUrl: String? = nil,
        context: ChatContext? = nil
    ) {
        self.conversationId = conversationId
        self.message = message
        self.inputType = inputType
        self.audioUrl = audioUrl
        self.context = context
    }
}

// MARK: - ChatContext

/// Optional context about the user's current screen/selection sent with each message.
struct ChatContext: Codable, Sendable {

    let screen: String?
    let selectedCampaignId: String?

    enum CodingKeys: String, CodingKey {
        case screen
        case selectedCampaignId = "selected_campaign_id"
    }
}

// MARK: - ConfirmRequest

/// Request body for POST /chat/confirm.
struct ConfirmRequest: Codable, Sendable {

    let conversationId: String
    let confirmationId: String
    let confirmed: Bool

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case confirmationId = "confirmation_id"
        case confirmed
    }
}

// MARK: - MessageListResponse

/// Response from GET /chat/conversations/:id/messages.
struct MessageListResponse: Codable, Sendable {
    let messages: [Message]
    let pagination: Pagination
}

// MARK: - SuggestionsResponse

/// Response from GET /chat/suggestions — greeting suggestions for new conversations.
struct SuggestionsResponse: Codable, Sendable {

    let suggestions: [SuggestedAction]
    let greeting: String
    let timestamp: String
}

// MARK: - BudgetResponse

/// Response from GET /chat/budget — current token budget status and usage stats.
struct BudgetResponse: Codable, Sendable {

    let budget: BudgetDetails
    let usage: UsageStats?
    let timestamp: String
}

// MARK: - BudgetDetails

/// Detailed budget information from the token budget manager.
struct BudgetDetails: Codable, Sendable {

    let used: Int
    let limit: Int
    let remaining: Int
    let percentUsed: Int
    let isExhausted: Bool
    let resetInSeconds: Int

    enum CodingKeys: String, CodingKey {
        case used
        case limit
        case remaining
        case percentUsed = "percent_used"
        case isExhausted = "is_exhausted"
        case resetInSeconds = "reset_in_seconds"
    }
}

// MARK: - UsageStats

/// Accumulated usage statistics for the current tenant.
struct UsageStats: Codable, Sendable {

    let totalInputTokens: Int?
    let totalOutputTokens: Int?
    let requestCount: Int?

    enum CodingKeys: String, CodingKey {
        case totalInputTokens = "total_input_tokens"
        case totalOutputTokens = "total_output_tokens"
        case requestCount = "request_count"
    }
}
