// ConversationSearchView.swift
// Algo
//
// A lightweight wrapper that embeds ConversationListView inside a
// NavigationStack, providing the search bar via the `.searchable`
// modifier applied within ConversationListView itself.
// Use this view as a standalone entry point when a dedicated
// search-first experience is needed.

import SwiftUI

// MARK: - ConversationSearchView

struct ConversationSearchView: View {

    // MARK: - Properties

    /// The repository used to load conversation data.
    let repository: ConversationRepositoryProtocol

    /// Called when the user selects a conversation.
    let onSelectConversation: (Conversation) -> Void

    /// Called when the user taps "New Chat".
    let onNewChat: () -> Void

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ConversationListView(
                repository: repository,
                onSelectConversation: onSelectConversation,
                onNewChat: onNewChat
            )
        }
    }
}

// MARK: - Preview

#Preview("Conversation Search") {
    ConversationSearchView(
        repository: PreviewSearchConversationRepo(),
        onSelectConversation: { _ in },
        onNewChat: {}
    )
}

/// A mock repository for previews.
private final class PreviewSearchConversationRepo: ConversationRepositoryProtocol {

    func getConversations(page: Int, limit: Int) async throws -> [Conversation] {
        [
            Conversation(
                id: "conv_1",
                title: "Campaign Performance",
                lastMessage: "Your Spring Sale campaign reached 12,000 impressions.",
                messageCount: 4,
                createdAt: Date().addingTimeInterval(-3600),
                updatedAt: Date().addingTimeInterval(-600)
            ),
            Conversation(
                id: "conv_2",
                title: "Lead Follow-up",
                lastMessage: "3 hot leads are waiting for a response.",
                messageCount: 2,
                createdAt: Date().addingTimeInterval(-86400),
                updatedAt: Date().addingTimeInterval(-3600)
            ),
        ]
    }

    func getMessages(conversationId: String, page: Int, limit: Int) async throws -> [Message] {
        []
    }

    func archiveConversation(id: String) async throws {}

    func clearCache() {}
}
