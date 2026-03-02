// ChatService.swift
// Algo
//
// Chat API service responsible for sending messages, confirming actions,
// and retrieving suggestions and budget info from the backend.

import Foundation

// MARK: - ChatServiceProtocol

protocol ChatServiceProtocol: Sendable {
    func sendMessage(
        conversationId: String?,
        message: String,
        inputType: String
    ) async throws -> ChatAPIResponse

    func confirmAction(
        conversationId: String,
        confirmationId: String,
        confirmed: Bool
    ) async throws -> ChatAPIResponse

    func getSuggestions() async throws -> SuggestionsResponse

    func getBudget() async throws -> BudgetResponse
}

// MARK: - ChatService

/// Service responsible for chat message send/receive, action confirmation,
/// and contextual suggestion / budget retrieval.
final class ChatService: ChatServiceProtocol {

    // MARK: - Dependencies

    private let apiClient: APIClient

    // MARK: - Initialization

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Send Message

    /// Sends a text or voice message to the AI assistant.
    ///
    /// - Parameters:
    ///   - conversationId: The existing conversation ID, or nil to start a new conversation.
    ///   - message: The user's message text (or transcribed voice input).
    ///   - inputType: Either "text" or "voice" indicating the input method.
    /// - Returns: The full chat API response including the assistant's reply.
    func sendMessage(
        conversationId: String?,
        message: String,
        inputType: String = "text"
    ) async throws -> ChatAPIResponse {
        let request = ChatRequest(
            conversationId: conversationId,
            message: message,
            inputType: inputType,
            context: ChatContext(screen: "chat", selectedCampaignId: nil)
        )

        return try await apiClient.post(.chatMessage, body: request)
    }

    // MARK: - Confirm Action

    /// Confirms or cancels a pending action that was proposed by the assistant.
    ///
    /// - Parameters:
    ///   - conversationId: The conversation containing the pending action.
    ///   - confirmationId: The unique ID of the confirmation prompt.
    ///   - confirmed: Whether the user confirmed (true) or cancelled (false) the action.
    /// - Returns: The response indicating the result of the confirmed/cancelled action.
    func confirmAction(
        conversationId: String,
        confirmationId: String,
        confirmed: Bool
    ) async throws -> ChatAPIResponse {
        let request = ConfirmRequest(
            conversationId: conversationId,
            confirmationId: confirmationId,
            confirmed: confirmed
        )

        return try await apiClient.post(.chatConfirm, body: request)
    }

    // MARK: - Suggestions

    /// Retrieves greeting suggestions for starting a new conversation.
    /// The suggestions are contextual based on the user's role and time of day.
    ///
    /// - Returns: A response containing suggested actions and a time-appropriate greeting.
    func getSuggestions() async throws -> SuggestionsResponse {
        return try await apiClient.get(.suggestions)
    }

    // MARK: - Budget

    /// Retrieves the current token budget status and usage statistics for the tenant.
    ///
    /// - Returns: The budget details including remaining tokens and usage stats.
    func getBudget() async throws -> BudgetResponse {
        return try await apiClient.get(.budget)
    }
}
