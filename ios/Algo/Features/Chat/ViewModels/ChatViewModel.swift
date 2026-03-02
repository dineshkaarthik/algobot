// ChatViewModel.swift
// Algo
//
// Main ViewModel for the chat interface. Manages message history, sending/receiving,
// WebSocket streaming, action confirmation, and suggested actions.

import Foundation
import Combine

// MARK: - ChatViewModel

@MainActor
final class ChatViewModel: ObservableObject {

    // MARK: - Published Properties

    /// The list of messages in the current conversation, ordered chronologically.
    @Published private(set) var messages: [Message] = []

    /// Whether a message send/receive operation is in progress.
    @Published private(set) var isLoading = false

    /// Whether the assistant is actively streaming a response via WebSocket.
    @Published private(set) var isStreaming = false

    /// The current error message to display, if any.
    @Published var error: String?

    /// Suggested follow-up actions returned by the last assistant message.
    @Published private(set) var suggestedActions: [SuggestedAction]?

    /// The current conversation ID. Nil for a new conversation.
    @Published private(set) var conversationId: String?

    // MARK: - Dependencies

    private let chatService: ChatServiceProtocol
    private let conversationRepository: ConversationRepositoryProtocol
    private let webSocketClient: WebSocketClient

    // MARK: - Internal State

    /// Accumulates streaming text chunks for the in-progress assistant message.
    private var streamingContent = ""

    /// The ID of the message currently being streamed.
    private var streamingMessageId: String?

    /// Combine cancellables for WebSocket event subscriptions.
    private var cancellables = Set<AnyCancellable>()

    /// Pagination state for loading older messages.
    private var currentPage = 1
    private var hasMoreMessages = false
    private var isLoadingMore = false

    // MARK: - Initialization

    /// Creates a new ChatViewModel.
    ///
    /// - Parameters:
    ///   - chatService: The service for sending messages and confirming actions.
    ///   - conversationRepository: The repository for loading message history.
    ///   - webSocketClient: The WebSocket client for real-time streaming.
    ///   - conversationId: An existing conversation ID to resume, or nil for new.
    init(
        chatService: ChatServiceProtocol,
        conversationRepository: ConversationRepositoryProtocol,
        webSocketClient: WebSocketClient,
        conversationId: String? = nil
    ) {
        self.chatService = chatService
        self.conversationRepository = conversationRepository
        self.webSocketClient = webSocketClient
        self.conversationId = conversationId
    }

    // MARK: - Public Methods

    /// Sends a text message to the assistant.
    ///
    /// Adds the user message to the local list immediately for responsiveness,
    /// then calls the chat API. On success, the assistant's response is appended.
    ///
    /// - Parameter text: The user's message text.
    func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        // Add user message locally for instant feedback
        let userMessage = Message(
            role: .user,
            content: trimmed,
            inputType: "text"
        )
        messages.append(userMessage)
        suggestedActions = nil
        error = nil

        isLoading = true

        Task {
            do {
                let response = try await chatService.sendMessage(
                    conversationId: conversationId,
                    message: trimmed,
                    inputType: "text"
                )

                handleChatResponse(response)
            } catch {
                handleError(error)
            }

            isLoading = false
        }
    }

    /// Executes a suggested action by mapping it to a message send.
    ///
    /// Special actions like CONFIRM_ACTION and CANCEL_ACTION are routed to
    /// the confirmation flow. All others are sent as a regular user message
    /// using the action's label text.
    ///
    /// - Parameter action: The suggested action to execute.
    func executeSuggestedAction(_ action: SuggestedAction) {
        switch action.action {
        case "CONFIRM_ACTION":
            if let actionId = action.params?["action_id"]?.stringValue {
                confirmAction(confirmationId: actionId, confirmed: true)
            }

        case "CANCEL_ACTION":
            if let actionId = action.params?["action_id"]?.stringValue {
                confirmAction(confirmationId: actionId, confirmed: false)
            }

        default:
            sendMessage(action.messageText)
        }
    }

    /// Confirms or cancels a pending action.
    ///
    /// - Parameters:
    ///   - confirmationId: The ID of the confirmation to respond to.
    ///   - confirmed: Whether the action is confirmed (true) or cancelled (false).
    func confirmAction(confirmationId: String, confirmed: Bool) {
        guard let conversationId else {
            error = "No active conversation for confirmation."
            return
        }

        isLoading = true
        error = nil

        Task {
            do {
                let response = try await chatService.confirmAction(
                    conversationId: conversationId,
                    confirmationId: confirmationId,
                    confirmed: confirmed
                )

                handleChatResponse(response)
            } catch {
                handleError(error)
            }

            isLoading = false
        }
    }

    /// Connects the WebSocket and begins listening for streaming events.
    ///
    /// Call this when the chat view appears to enable real-time streaming
    /// responses, typing indicators, and alerts.
    func connectWebSocket() {
        webSocketClient.connect()
        subscribeToWebSocketEvents()
    }

    /// Disconnects the WebSocket connection.
    ///
    /// Call this when the chat view disappears to conserve resources.
    func disconnectWebSocket() {
        webSocketClient.disconnect()
        cancellables.removeAll()
    }

    /// Loads older messages for the current conversation (pagination).
    func loadMoreMessages() async {
        guard let conversationId,
              hasMoreMessages,
              !isLoadingMore else { return }

        isLoadingMore = true

        do {
            let nextPage = currentPage + 1
            let olderMessages = try await conversationRepository.getMessages(
                conversationId: conversationId,
                page: nextPage,
                limit: 50
            )

            // Prepend older messages to the beginning
            messages.insert(contentsOf: olderMessages, at: 0)
            currentPage = nextPage
            // If fewer messages returned than requested, no more pages
            hasMoreMessages = olderMessages.count >= 50
        } catch {
            self.error = userFriendlyMessage(for: error)
        }

        isLoadingMore = false
    }

    /// Loads the initial message history for an existing conversation.
    func loadInitialMessages() async {
        guard let conversationId else { return }

        isLoading = true

        do {
            let loadedMessages = try await conversationRepository.getMessages(
                conversationId: conversationId,
                page: 1,
                limit: 50
            )

            messages = loadedMessages
            currentPage = 1
            hasMoreMessages = loadedMessages.count >= 50

            // Set suggested actions from the last assistant message
            if let lastAssistant = messages.last(where: { $0.isAssistant }) {
                suggestedActions = lastAssistant.suggestedActions
            }
        } catch {
            self.error = userFriendlyMessage(for: error)
        }

        isLoading = false
    }

    /// Clears the conversation state for starting a new chat.
    func startNewConversation() {
        messages.removeAll()
        conversationId = nil
        suggestedActions = nil
        error = nil
        currentPage = 1
        hasMoreMessages = false
        streamingContent = ""
        streamingMessageId = nil
        isStreaming = false
    }

    // MARK: - Private Methods

    /// Processes a successful chat API response.
    private func handleChatResponse(_ response: ChatAPIResponse) {
        // Update conversation ID (may be assigned by server for new conversations)
        conversationId = response.conversationId

        // Convert the API response to a Message and append it
        let assistantMessage = response.toMessage()
        messages.append(assistantMessage)

        // Update suggested actions
        suggestedActions = response.response.suggestedActions
    }

    /// Subscribes to WebSocket events for real-time streaming.
    private func subscribeToWebSocketEvents() {
        webSocketClient.events
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                self?.handleWebSocketEvent(event)
            }
            .store(in: &cancellables)
    }

    /// Routes individual WebSocket events to the appropriate handler.
    private func handleWebSocketEvent(_ event: WebSocketEvent) {
        guard let conversationId else { return }

        switch event {
        case .typing(let eventConversationId):
            guard eventConversationId == conversationId else { return }
            if !isStreaming {
                isStreaming = true
                streamingContent = ""
            }

        case .streamChunk(let eventConversationId, let chunk):
            guard eventConversationId == conversationId else { return }
            handleStreamChunk(chunk)

        case .streamEnd(let eventConversationId, let messageId):
            guard eventConversationId == conversationId else { return }
            handleStreamEnd(messageId: messageId)

        case .connected:
            break

        case .disconnected:
            if isStreaming {
                finalizeStreamingMessage()
            }

        case .alert, .metricUpdate:
            break
        }
    }

    /// Accumulates a streaming text chunk into the in-progress assistant message.
    private func handleStreamChunk(_ chunk: String) {
        isStreaming = true
        streamingContent += chunk

        if streamingMessageId == nil {
            let placeholderId = "streaming_\(UUID().uuidString.prefix(8))"
            streamingMessageId = placeholderId

            let streamingMessage = Message(
                id: placeholderId,
                role: .assistant,
                content: streamingContent
            )
            messages.append(streamingMessage)
        } else if let index = messages.lastIndex(where: { $0.id == streamingMessageId }) {
            messages[index] = Message(
                id: messages[index].id,
                role: .assistant,
                content: streamingContent
            )
        }
    }

    /// Finalizes a streaming response when the stream ends.
    private func handleStreamEnd(messageId: String) {
        if let index = messages.lastIndex(where: { $0.id == streamingMessageId }) {
            messages[index] = Message(
                id: messageId,
                role: .assistant,
                content: streamingContent
            )
        }

        finalizeStreamingMessage()
    }

    /// Resets streaming state after a stream completes or is interrupted.
    private func finalizeStreamingMessage() {
        isStreaming = false
        streamingContent = ""
        streamingMessageId = nil
    }

    /// Converts any error into a user-friendly error message.
    private func handleError(_ error: Error) {
        self.error = userFriendlyMessage(for: error)
    }

    /// Returns a user-friendly message string for a given error.
    private func userFriendlyMessage(for error: Error) -> String {
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? "Something went wrong. Please try again."
        }
        return "Something went wrong. Please try again."
    }
}
