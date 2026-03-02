// ConversationRepository.swift
// Algo
//
// Conversation data layer providing access to conversation and message data
// with local caching for offline-first behavior and improved responsiveness.

import Foundation

// MARK: - ConversationRepositoryProtocol

protocol ConversationRepositoryProtocol: Sendable {
    func getConversations(page: Int, limit: Int) async throws -> [Conversation]
    func getMessages(conversationId: String, page: Int, limit: Int) async throws -> [Message]
    func archiveConversation(id: String) async throws
    func clearCache()
}

// MARK: - ConversationRepository

/// Repository for fetching and managing conversation history.
/// Provides a caching layer for offline-first behavior with background refresh.
final class ConversationRepository: ConversationRepositoryProtocol {

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let cache: ConversationCache

    // MARK: - Initialization

    init(apiClient: APIClient, cache: ConversationCache = ConversationCache()) {
        self.apiClient = apiClient
        self.cache = cache
    }

    // MARK: - Get Conversations

    /// Fetches the user's conversation list, returning cached data first if available
    /// and then refreshing from the network in the background.
    ///
    /// - Parameters:
    ///   - page: The page number to fetch (1-indexed).
    ///   - limit: The maximum number of conversations per page.
    /// - Returns: An array of conversations sorted by most recently updated.
    func getConversations(page: Int = 1, limit: Int = 20) async throws -> [Conversation] {
        // Try to return cached conversations for the first page immediately.
        if page == 1, let cached = cache.loadConversations(), !cached.isEmpty {
            // Fire-and-forget background refresh.
            Task { [weak self] in
                try? await self?.refreshConversations(page: page, limit: limit)
            }
            return cached
        }

        return try await refreshConversations(page: page, limit: limit)
    }

    // MARK: - Get Messages

    /// Fetches messages for a specific conversation with local caching.
    ///
    /// - Parameters:
    ///   - conversationId: The conversation to load messages for.
    ///   - page: The page number to fetch (1-indexed).
    ///   - limit: The maximum number of messages per page.
    /// - Returns: An array of messages sorted by timestamp (oldest first).
    func getMessages(
        conversationId: String,
        page: Int = 1,
        limit: Int = 50
    ) async throws -> [Message] {
        // Try cache for the first page.
        if page == 1, let cached = cache.loadMessages(for: conversationId), !cached.isEmpty {
            Task { [weak self] in
                try? await self?.refreshMessages(
                    conversationId: conversationId,
                    page: page,
                    limit: limit
                )
            }
            return cached
        }

        return try await refreshMessages(conversationId: conversationId, page: page, limit: limit)
    }

    // MARK: - Archive Conversation

    /// Archives a conversation, removing it from the active list.
    ///
    /// - Parameter id: The conversation ID to archive.
    func archiveConversation(id: String) async throws {
        try await apiClient.delete(.archiveConversation(conversationId: id))

        // Remove from local cache.
        cache.removeConversation(id: id)
    }

    // MARK: - Cache Management

    /// Clears all cached conversations and messages.
    func clearCache() {
        cache.clearAll()
    }

    // MARK: - Cache a New Message Locally

    /// Appends a message to the local cache for immediate display before
    /// the server response arrives. Called by ChatViewModel for optimistic updates.
    ///
    /// - Parameters:
    ///   - message: The message to cache.
    ///   - conversationId: The conversation the message belongs to.
    func cacheMessage(_ message: Message, for conversationId: String) {
        cache.appendMessage(message, for: conversationId)
    }

    // MARK: - Private Network Methods

    @discardableResult
    private func refreshConversations(page: Int, limit: Int) async throws -> [Conversation] {
        let response: ConversationListResponse = try await apiClient.get(
            .conversations,
            queryItems: [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "limit", value: "\(limit)")
            ]
        )

        // Cache the first page of conversations.
        if page == 1 {
            cache.saveConversations(response.conversations)
        }

        return response.conversations
    }

    @discardableResult
    private func refreshMessages(
        conversationId: String,
        page: Int,
        limit: Int
    ) async throws -> [Message] {
        let response: MessageListResponse = try await apiClient.get(
            .conversationMessages(conversationId: conversationId),
            queryItems: [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "limit", value: "\(limit)")
            ]
        )

        // Cache the first page of messages.
        if page == 1 {
            cache.saveMessages(response.messages, for: conversationId)
        }

        return response.messages
    }
}

// MARK: - ConversationCache

/// Local cache for conversations and messages using UserDefaults with JSON serialization.
/// Provides fast reads for offline-first behavior and optimistic UI updates.
///
/// Note: For production scale, consider migrating to SwiftData or a file-based cache.
/// UserDefaults is used here for simplicity during MVP.
final class ConversationCache: @unchecked Sendable {

    // MARK: - Constants

    private enum Key {
        static let conversations = "com.algonit.algo.cache.conversations"

        static func messages(conversationId: String) -> String {
            "com.algonit.algo.cache.messages.\(conversationId)"
        }
    }

    /// Maximum age (in seconds) before cached data is considered stale.
    private let maxCacheAge: TimeInterval = 300 // 5 minutes

    private let defaults: UserDefaults
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let lock = NSLock()

    // MARK: - Initialization

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        self.encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601

        self.decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
    }

    // MARK: - Conversations

    func saveConversations(_ conversations: [Conversation]) {
        lock.lock()
        defer { lock.unlock() }

        let entry = CacheEntry(data: conversations, cachedAt: Date())
        if let data = try? encoder.encode(entry) {
            defaults.set(data, forKey: Key.conversations)
        }
    }

    func loadConversations() -> [Conversation]? {
        lock.lock()
        defer { lock.unlock() }

        guard let data = defaults.data(forKey: Key.conversations),
              let entry = try? decoder.decode(CacheEntry<[Conversation]>.self, from: data),
              !entry.isStale(maxAge: maxCacheAge) else {
            return nil
        }

        return entry.data
    }

    func removeConversation(id: String) {
        lock.lock()
        defer { lock.unlock() }

        guard let data = defaults.data(forKey: Key.conversations),
              var entry = try? decoder.decode(CacheEntry<[Conversation]>.self, from: data) else {
            return
        }

        entry.data.removeAll { $0.id == id }
        if let updated = try? encoder.encode(entry) {
            defaults.set(updated, forKey: Key.conversations)
        }

        // Also remove cached messages for that conversation.
        defaults.removeObject(forKey: Key.messages(conversationId: id))
    }

    // MARK: - Messages

    func saveMessages(_ messages: [Message], for conversationId: String) {
        lock.lock()
        defer { lock.unlock() }

        let entry = CacheEntry(data: messages, cachedAt: Date())
        if let data = try? encoder.encode(entry) {
            defaults.set(data, forKey: Key.messages(conversationId: conversationId))
        }
    }

    func loadMessages(for conversationId: String) -> [Message]? {
        lock.lock()
        defer { lock.unlock() }

        let key = Key.messages(conversationId: conversationId)
        guard let data = defaults.data(forKey: key),
              let entry = try? decoder.decode(CacheEntry<[Message]>.self, from: data),
              !entry.isStale(maxAge: maxCacheAge) else {
            return nil
        }

        return entry.data
    }

    func appendMessage(_ message: Message, for conversationId: String) {
        lock.lock()
        defer { lock.unlock() }

        let key = Key.messages(conversationId: conversationId)
        var messages: [Message] = []

        if let data = defaults.data(forKey: key),
           let entry = try? decoder.decode(CacheEntry<[Message]>.self, from: data) {
            messages = entry.data
        }

        messages.append(message)

        let entry = CacheEntry(data: messages, cachedAt: Date())
        if let data = try? encoder.encode(entry) {
            defaults.set(data, forKey: key)
        }
    }

    // MARK: - Clear All

    func clearAll() {
        lock.lock()
        defer { lock.unlock() }

        defaults.removeObject(forKey: Key.conversations)

        // Remove all cached message keys.
        let allKeys = defaults.dictionaryRepresentation().keys
        for key in allKeys where key.hasPrefix("com.algonit.algo.cache.messages.") {
            defaults.removeObject(forKey: key)
        }
    }
}

// MARK: - CacheEntry

/// A timestamped wrapper for cached data to support staleness checks.
private struct CacheEntry<T: Codable>: Codable {
    var data: T
    let cachedAt: Date

    enum CodingKeys: String, CodingKey {
        case data
        case cachedAt = "cached_at"
    }

    func isStale(maxAge: TimeInterval) -> Bool {
        Date().timeIntervalSince(cachedAt) > maxAge
    }
}
