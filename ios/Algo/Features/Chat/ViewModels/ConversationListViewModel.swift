// ConversationListViewModel.swift
// Algo
//
// ViewModel for the conversation history list. Handles loading, pagination,
// and archiving of conversations.

import Foundation

// MARK: - ConversationListViewModel

@MainActor
final class ConversationListViewModel: ObservableObject {

    // MARK: - Published Properties

    /// The list of conversations to display.
    @Published private(set) var conversations: [Conversation] = []

    /// Whether the initial load is in progress.
    @Published private(set) var isLoading = false

    /// The current error message, if any.
    @Published var error: String?

    // MARK: - Dependencies

    private let repository: ConversationRepositoryProtocol

    // MARK: - Pagination State

    private var currentPage = 1
    private let pageSize = 20
    private var hasMore = true
    private var isLoadingPage = false

    // MARK: - Initialization

    /// Creates a new ConversationListViewModel.
    ///
    /// - Parameter repository: The repository for fetching conversation data.
    init(repository: ConversationRepositoryProtocol) {
        self.repository = repository
    }

    // MARK: - Public Methods

    /// Loads the first page of conversations.
    ///
    /// Resets pagination state and replaces the current conversation list.
    func loadConversations() async {
        isLoading = true
        error = nil
        currentPage = 1
        hasMore = true

        do {
            let result = try await repository.getConversations(
                page: currentPage,
                limit: pageSize
            )

            conversations = result
            hasMore = result.count >= pageSize
        } catch {
            self.error = userFriendlyMessage(for: error)
        }

        isLoading = false
    }

    /// Loads the next page of conversations and appends them to the list.
    func loadNextPage() async {
        guard hasMore, !isLoadingPage else { return }

        isLoadingPage = true

        do {
            let nextPage = currentPage + 1
            let result = try await repository.getConversations(
                page: nextPage,
                limit: pageSize
            )

            conversations.append(contentsOf: result)
            currentPage = nextPage
            hasMore = result.count >= pageSize
        } catch {
            self.error = userFriendlyMessage(for: error)
        }

        isLoadingPage = false
    }

    /// Archives a conversation by ID and removes it from the list.
    ///
    /// - Parameter id: The conversation ID to archive.
    func archiveConversation(id: String) async {
        do {
            try await repository.archiveConversation(id: id)
            conversations.removeAll { $0.id == id }
        } catch {
            self.error = userFriendlyMessage(for: error)
        }
    }

    /// Refreshes the conversation list from the first page (pull-to-refresh).
    func refresh() async {
        await loadConversations()
    }

    /// Whether the list is empty and not loading.
    var isEmpty: Bool {
        conversations.isEmpty && !isLoading
    }

    /// Triggers pagination when the user scrolls near the bottom.
    ///
    /// - Parameter conversation: The conversation row that just appeared.
    func loadMoreIfNeeded(currentItem: Conversation) {
        guard let lastItem = conversations.last,
              lastItem.id == currentItem.id,
              hasMore,
              !isLoadingPage else { return }

        Task {
            await loadNextPage()
        }
    }

    // MARK: - Private Methods

    private func userFriendlyMessage(for error: Error) -> String {
        if let apiError = error as? APIError {
            return apiError.errorDescription ?? "Failed to load conversations."
        }
        return "Failed to load conversations. Please try again."
    }
}
