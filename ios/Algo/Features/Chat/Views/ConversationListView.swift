// ConversationListView.swift
// Algo
//
// Conversation history list view showing past chat sessions.
// Supports swipe-to-archive, pull-to-refresh, pagination,
// and a "New Chat" action in the toolbar.

import SwiftUI

// MARK: - ConversationListView

struct ConversationListView: View {

    // MARK: - Properties

    @StateObject private var viewModel: ConversationListViewModel

    /// The current search query entered in the search bar.
    @State private var searchText = ""

    /// Callback invoked when a conversation is selected for viewing.
    let onSelectConversation: (Conversation) -> Void

    /// Callback invoked when the user wants to start a new chat.
    let onNewChat: () -> Void

    // MARK: - Initialization

    /// Creates a ConversationListView with the required dependencies.
    ///
    /// - Parameters:
    ///   - repository: The repository for loading conversation data.
    ///   - onSelectConversation: Called when a conversation row is tapped.
    ///   - onNewChat: Called when the "New Chat" button is tapped.
    init(
        repository: ConversationRepositoryProtocol,
        onSelectConversation: @escaping (Conversation) -> Void,
        onNewChat: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: ConversationListViewModel(repository: repository))
        self.onSelectConversation = onSelectConversation
        self.onNewChat = onNewChat
    }

    // MARK: - Filtered Conversations

    /// Conversations filtered by the current search query.
    /// Matches against the display title and message preview.
    private var filteredConversations: [Conversation] {
        guard !searchText.isEmpty else {
            return viewModel.conversations
        }
        let query = searchText.lowercased()
        return viewModel.conversations.filter { conversation in
            conversation.displayTitle.lowercased().contains(query)
                || (conversation.messagePreview?.lowercased().contains(query) ?? false)
        }
    }

    // MARK: - Body

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.conversations.isEmpty {
                LoadingView("Loading conversations...")
            } else if viewModel.isEmpty {
                emptyStateView
            } else {
                conversationList
            }
        }
        .navigationTitle("Conversations")
        .searchable(text: $searchText, prompt: "Search conversations")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: onNewChat) {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: AlgoTheme.IconSize.md))
                }
                .accessibilityLabel("New chat")
            }
        }
        .alert("Error", isPresented: showErrorBinding) {
            Button("OK") { viewModel.error = nil }
        } message: {
            Text(viewModel.error ?? "")
        }
        .task {
            await viewModel.loadConversations()
        }
    }

    // MARK: - Conversation List

    private var conversationList: some View {
        List {
            ForEach(filteredConversations) { conversation in
                conversationRow(for: conversation)
                    .onAppear {
                        viewModel.loadMoreIfNeeded(currentItem: conversation)
                    }
            }
            .onDelete(perform: archiveConversations)
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: - Conversation Row

    private func conversationRow(for conversation: Conversation) -> some View {
        Button {
            onSelectConversation(conversation)
        } label: {
            HStack(spacing: AlgoTheme.Spacing.sm) {
                // Conversation icon
                Circle()
                    .fill(AlgoTheme.Colors.primary.opacity(0.1))
                    .frame(width: 40, height: 40)
                    .overlay(
                        Image(systemName: "bubble.left.and.bubble.right")
                            .font(.system(size: 16))
                            .foregroundStyle(AlgoTheme.Colors.primary)
                    )

                // Conversation details
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxxs) {
                    HStack {
                        Text(conversation.displayTitle)
                            .font(AlgoTypography.labelLarge)
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)
                            .lineLimit(1)

                        Spacer()

                        Text(conversation.updatedAt.relativeFormat)
                            .font(AlgoTypography.caption)
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }

                    HStack {
                        if let preview = conversation.messagePreview {
                            Text(preview)
                                .font(AlgoTypography.bodySmall)
                                .foregroundStyle(AlgoTheme.Colors.textSecondary)
                                .lineLimit(2)
                        }

                        Spacer()

                        messageCountBadge(conversation.messageCount)
                    }
                }
            }
            .padding(.vertical, AlgoTheme.Spacing.xxs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) {
                Task {
                    await viewModel.archiveConversation(id: conversation.id)
                }
            } label: {
                Label("Archive", systemImage: "archivebox")
            }
            .tint(AlgoTheme.Colors.warning)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(conversationAccessibilityLabel(for: conversation))
        .accessibilityHint("Tap to open conversation")
    }

    // MARK: - Message Count Badge

    private func messageCountBadge(_ count: Int) -> some View {
        Text("\(count)")
            .font(AlgoTypography.captionBold)
            .foregroundStyle(AlgoTheme.Colors.textTertiary)
            .padding(.horizontal, AlgoTheme.Spacing.xxs)
            .padding(.vertical, 2)
            .background(AlgoTheme.Colors.secondaryBackground)
            .clipShape(Capsule())
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        ContentUnavailableView {
            Label("No Conversations", systemImage: "bubble.left.and.bubble.right")
        } description: {
            Text("Start a new chat with Algo to get insights about your marketing performance.")
        } actions: {
            Button(action: onNewChat) {
                Label("Start a New Chat", systemImage: "square.and.pencil")
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - Swipe to Archive

    private func archiveConversations(at offsets: IndexSet) {
        for index in offsets {
            let conversation = viewModel.conversations[index]
            Task {
                await viewModel.archiveConversation(id: conversation.id)
            }
        }
    }

    // MARK: - Helpers

    private var showErrorBinding: Binding<Bool> {
        Binding(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )
    }

    private func conversationAccessibilityLabel(for conversation: Conversation) -> String {
        let title = conversation.displayTitle
        let time = conversation.updatedAt.relativeFormat
        let count = conversation.messageCount
        return "\(title), \(count) messages, updated \(time)"
    }
}

// MARK: - Preview

#Preview("Conversation List") {
    NavigationStack {
        ConversationListView(
            repository: PreviewConversationRepo(),
            onSelectConversation: { conv in
                print("Selected: \(conv.displayTitle)")
            },
            onNewChat: {
                print("New chat")
            }
        )
    }
}

/// A mock repository for previews.
private final class PreviewConversationRepo: ConversationRepositoryProtocol {

    func getConversations(page: Int, limit: Int) async throws -> [Conversation] {
        [
            Conversation(
                id: "conv_1",
                title: "Campaign Performance Check",
                lastMessage: "Done! The 'Spring Sale' campaign has been paused.",
                messageCount: 5,
                createdAt: Date().addingTimeInterval(-3600),
                updatedAt: Date().addingTimeInterval(-300)
            ),
            Conversation(
                id: "conv_2",
                title: "Lead Analysis",
                lastMessage: "You have 5 hot leads requiring follow-up today.",
                messageCount: 3,
                createdAt: Date().addingTimeInterval(-86400),
                updatedAt: Date().addingTimeInterval(-7200)
            ),
            Conversation(
                id: "conv_3",
                title: "Content Generation",
                lastMessage: "Here's your LinkedIn post draft for Q1 results.",
                messageCount: 8,
                createdAt: Date().addingTimeInterval(-172800),
                updatedAt: Date().addingTimeInterval(-86400)
            )
        ]
    }

    func getMessages(conversationId: String, page: Int, limit: Int) async throws -> [Message] {
        []
    }

    func archiveConversation(id: String) async throws {}

    func clearCache() {}
}
