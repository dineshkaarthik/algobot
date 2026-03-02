// ChatView.swift
// Algo
//
// Main chat interface with message list, suggested actions bar,
// voice/text input, and streaming indicator.

import SwiftUI

// MARK: - ChatView

struct ChatView: View {

    // MARK: - Properties

    @StateObject private var viewModel: ChatViewModel
    @State private var inputText = ""
    @State private var isRecording = false
    @FocusState private var isInputFocused: Bool

    // MARK: - Initialization

    /// Creates a ChatView with the required dependencies.
    ///
    /// - Parameters:
    ///   - chatService: The chat service for sending/receiving messages.
    ///   - conversationRepository: The repository for loading message history.
    ///   - webSocketClient: The WebSocket client for real-time streaming.
    ///   - conversationId: An optional conversation ID to resume.
    init(
        chatService: ChatServiceProtocol,
        conversationRepository: ConversationRepositoryProtocol,
        webSocketClient: WebSocketClient,
        conversationId: String? = nil
    ) {
        _viewModel = StateObject(wrappedValue: ChatViewModel(
            chatService: chatService,
            conversationRepository: conversationRepository,
            webSocketClient: webSocketClient,
            conversationId: conversationId
        ))
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            messageList
            streamingIndicator
            suggestedActionsSection
            inputBar
        }
        .navigationTitle("Algo")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Error", isPresented: showErrorBinding) {
            Button("OK") { viewModel.error = nil }
        } message: {
            Text(viewModel.error ?? "")
        }
        .onAppear {
            viewModel.connectWebSocket()
            if viewModel.conversationId != nil {
                Task { await viewModel.loadInitialMessages() }
            }
        }
        .onDisappear {
            viewModel.disconnectWebSocket()
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: AlgoTheme.Spacing.sm) {
                    // Pull-to-load-more trigger at top
                    if viewModel.conversationId != nil {
                        Color.clear
                            .frame(height: 1)
                            .onAppear {
                                Task { await viewModel.loadMoreMessages() }
                            }
                    }

                    ForEach(viewModel.messages) { message in
                        MessageBubble(
                            message: message,
                            onConfirm: { confirmationId, confirmed in
                                viewModel.confirmAction(
                                    confirmationId: confirmationId,
                                    confirmed: confirmed
                                )
                            }
                        )
                        .id(message.id)
                        .transition(.asymmetric(
                            insertion: .move(edge: .bottom).combined(with: .opacity),
                            removal: .opacity
                        ))
                    }
                }
                .padding(.horizontal, AlgoTheme.Spacing.md)
                .padding(.vertical, AlgoTheme.Spacing.xs)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.messages.count) { _, _ in
                withAnimation(AlgoTheme.Animation.standard) {
                    if let lastMessage = viewModel.messages.last {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Streaming Indicator

    @ViewBuilder
    private var streamingIndicator: some View {
        if viewModel.isStreaming {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                ProgressView()
                    .controlSize(.small)

                Text("Algo is thinking...")
                    .font(AlgoTypography.caption)
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
            }
            .padding(.horizontal, AlgoTheme.Spacing.md)
            .padding(.vertical, AlgoTheme.Spacing.xs)
            .frame(maxWidth: .infinity, alignment: .leading)
            .transition(.opacity)
        }
    }

    // MARK: - Suggested Actions

    @ViewBuilder
    private var suggestedActionsSection: some View {
        if let actions = viewModel.suggestedActions, !actions.isEmpty {
            SuggestedActionsBar(actions: actions) { action in
                viewModel.executeSuggestedAction(action)
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(spacing: AlgoTheme.Spacing.sm) {
            TextField("Ask Algo...", text: $inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .font(AlgoTypography.bodyMedium)
                .lineLimit(1...5)
                .padding(.horizontal, AlgoTheme.Spacing.sm)
                .padding(.vertical, AlgoTheme.Spacing.xs)
                .background(AlgoTheme.Colors.secondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.lg))
                .focused($isInputFocused)
                .onSubmit { sendMessage() }
                .accessibilityLabel("Message input")
                .accessibilityHint("Type your message to Algo")

            VoiceInputButton(isRecording: $isRecording) { transcribedText in
                inputText = transcribedText
                sendMessage()
            }

            Button(action: sendMessage) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(
                        canSend
                            ? AlgoTheme.Colors.primary
                            : AlgoTheme.Colors.disabled
                    )
            }
            .disabled(!canSend)
            .accessibilityLabel("Send message")
            .accessibilityHint(canSend ? "Send your message" : "Type a message first")
        }
        .padding(.horizontal, AlgoTheme.Spacing.md)
        .padding(.vertical, AlgoTheme.Spacing.sm)
        .background(
            AlgoTheme.Colors.surface
                .shadow(color: .black.opacity(0.05), radius: 4, y: -2)
        )
    }

    // MARK: - Helpers

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !viewModel.isLoading
    }

    private var showErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        viewModel.sendMessage(text)
        inputText = ""
        isInputFocused = false
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        ChatView(
            chatService: PreviewChatService(),
            conversationRepository: PreviewConversationRepository(),
            webSocketClient: WebSocketClient(keychainManager: KeychainManager())
        )
    }
}

// MARK: - Preview Mocks

/// A mock chat service for SwiftUI previews.
private final class PreviewChatService: ChatServiceProtocol {

    func sendMessage(
        conversationId: String?,
        message: String,
        inputType: String
    ) async throws -> ChatAPIResponse {
        try await Task.sleep(for: .seconds(1))
        return ChatAPIResponse(
            conversationId: conversationId ?? "conv_preview",
            messageId: "msg_\(UUID().uuidString.prefix(8))",
            response: ChatResponseBody(
                text: "This is a preview response to: \(message)",
                structuredData: nil,
                suggestedActions: [
                    SuggestedAction(label: "Tell me more", action: "TELL_MORE", params: nil)
                ],
                requiresConfirmation: false,
                confirmationId: nil
            ),
            intent: nil,
            reasoningSummary: nil,
            tokenBudget: nil,
            timestamp: ISO8601DateFormatter().string(from: .now)
        )
    }

    func confirmAction(
        conversationId: String,
        confirmationId: String,
        confirmed: Bool
    ) async throws -> ChatAPIResponse {
        ChatAPIResponse(
            conversationId: conversationId,
            messageId: "msg_confirm",
            response: ChatResponseBody(
                text: confirmed ? "Action confirmed." : "Action cancelled.",
                structuredData: nil,
                suggestedActions: nil,
                requiresConfirmation: false,
                confirmationId: nil
            ),
            intent: nil,
            reasoningSummary: nil,
            tokenBudget: nil,
            timestamp: ISO8601DateFormatter().string(from: .now)
        )
    }

    func getSuggestions() async throws -> SuggestionsResponse {
        SuggestionsResponse(
            suggestions: [
                SuggestedAction(label: "Show dashboard", action: "SHOW_DASHBOARD", params: nil)
            ],
            greeting: "Hello! How can I help?",
            timestamp: ISO8601DateFormatter().string(from: .now)
        )
    }

    func getBudget() async throws -> BudgetResponse {
        BudgetResponse(
            budget: BudgetDetails(
                used: 500, limit: 10000, remaining: 9500,
                percentUsed: 5, isExhausted: false, resetInSeconds: 3600
            ),
            usage: nil,
            timestamp: ISO8601DateFormatter().string(from: .now)
        )
    }
}

/// A mock conversation repository for SwiftUI previews.
private final class PreviewConversationRepository: ConversationRepositoryProtocol {

    func getConversations(page: Int, limit: Int) async throws -> [Conversation] {
        []
    }

    func getMessages(conversationId: String, page: Int, limit: Int) async throws -> [Message] {
        []
    }

    func archiveConversation(id: String) async throws {}

    func clearCache() {}
}
