// ConversationCache.swift
// Algo
//
// In-memory LRU cache for recent conversations and their messages.
// Provides fast access to recently viewed conversations without
// network requests, with automatic eviction of old entries.

import Foundation
import os

// MARK: - Cached Models

/// A lightweight conversation summary stored in the cache.
struct CachedConversation: Identifiable, Equatable {
    let id: String
    var title: String
    var lastMessage: String
    var messageCount: Int
    var createdAt: Date
    var updatedAt: Date
}

/// A lightweight message stored in the cache.
struct CachedMessage: Identifiable, Equatable {
    let id: String
    let conversationId: String
    let role: String
    let content: String
    let inputType: String?
    let timestamp: Date
}

// MARK: - ConversationCache

/// An in-memory LRU cache for conversations and their messages.
///
/// Stores the most recently accessed conversations and their messages with
/// configurable size limits. When the cache exceeds its capacity, the least
/// recently accessed entries are evicted.
///
/// Thread-safe via actor isolation.
///
/// Usage:
/// ```swift
/// let cache = ConversationCache()
/// cache.cacheConversation(conversation)
/// cache.cacheMessages(messages, forConversation: "conv_123")
///
/// let cached = cache.getConversation("conv_123")
/// let messages = cache.getMessages(forConversation: "conv_123")
/// ```
actor ConversationCache {

    // MARK: - Configuration

    /// Maximum number of conversations to keep in cache.
    private let maxConversations: Int

    /// Maximum number of messages to keep per conversation.
    private let maxMessagesPerConversation: Int

    // MARK: - Storage

    /// Ordered list of conversation IDs, most recently accessed first.
    private var conversationOrder: [String] = []

    /// Conversation data keyed by conversation ID.
    private var conversations: [String: CachedConversation] = [:]

    /// Messages keyed by conversation ID, ordered by timestamp.
    private var messages: [String: [CachedMessage]] = [:]

    private let logger = Logger(subsystem: "com.algonit.algo", category: "ConversationCache")

    // MARK: - Initialization

    /// Creates a new conversation cache.
    ///
    /// - Parameters:
    ///   - maxConversations: Maximum number of conversations to cache. Defaults to 50.
    ///   - maxMessagesPerConversation: Maximum messages per conversation. Defaults to 200.
    init(maxConversations: Int = 50, maxMessagesPerConversation: Int = 200) {
        self.maxConversations = maxConversations
        self.maxMessagesPerConversation = maxMessagesPerConversation
    }

    // MARK: - Conversation Operations

    /// Stores or updates a conversation in the cache.
    ///
    /// The conversation is moved to the front of the LRU order.
    /// If the cache exceeds `maxConversations`, the least recently accessed
    /// conversation (and its messages) are evicted.
    ///
    /// - Parameter conversation: The conversation to cache.
    func cacheConversation(_ conversation: CachedConversation) {
        let id = conversation.id

        // Move to front of LRU order
        conversationOrder.removeAll { $0 == id }
        conversationOrder.insert(id, at: 0)

        conversations[id] = conversation

        // Evict oldest if over capacity
        while conversationOrder.count > maxConversations {
            if let evictedId = conversationOrder.popLast() {
                conversations.removeValue(forKey: evictedId)
                messages.removeValue(forKey: evictedId)
                logger.debug("Evicted conversation \(evictedId) from cache")
            }
        }
    }

    /// Stores multiple conversations in the cache.
    ///
    /// - Parameter conversationList: The conversations to cache.
    func cacheConversations(_ conversationList: [CachedConversation]) {
        for conversation in conversationList {
            cacheConversation(conversation)
        }
    }

    /// Retrieves a conversation from the cache by ID.
    ///
    /// Accessing a conversation moves it to the front of the LRU order.
    ///
    /// - Parameter id: The conversation ID to look up.
    /// - Returns: The cached conversation, or `nil` if not found.
    func getConversation(_ id: String) -> CachedConversation? {
        guard let conversation = conversations[id] else { return nil }

        // Update LRU order on access
        conversationOrder.removeAll { $0 == id }
        conversationOrder.insert(id, at: 0)

        return conversation
    }

    /// Returns all cached conversations in LRU order (most recent first).
    func getAllConversations() -> [CachedConversation] {
        conversationOrder.compactMap { conversations[$0] }
    }

    /// Removes a conversation and its messages from the cache.
    ///
    /// - Parameter id: The conversation ID to remove.
    func removeConversation(_ id: String) {
        conversationOrder.removeAll { $0 == id }
        conversations.removeValue(forKey: id)
        messages.removeValue(forKey: id)
    }

    // MARK: - Message Operations

    /// Stores messages for a conversation, replacing any existing cached messages.
    ///
    /// If the number of messages exceeds `maxMessagesPerConversation`, the oldest
    /// messages (by timestamp) are dropped.
    ///
    /// - Parameters:
    ///   - messageList: The messages to cache.
    ///   - conversationId: The conversation these messages belong to.
    func cacheMessages(_ messageList: [CachedMessage], forConversation conversationId: String) {
        var sorted = messageList.sorted { $0.timestamp < $1.timestamp }

        // Trim to max capacity, keeping the most recent messages
        if sorted.count > maxMessagesPerConversation {
            sorted = Array(sorted.suffix(maxMessagesPerConversation))
        }

        messages[conversationId] = sorted

        // Touch the conversation in LRU order
        if conversationOrder.contains(conversationId) {
            conversationOrder.removeAll { $0 == conversationId }
            conversationOrder.insert(conversationId, at: 0)
        }
    }

    /// Appends a single message to the cached messages for a conversation.
    ///
    /// If the cache exceeds `maxMessagesPerConversation`, the oldest message is removed.
    ///
    /// - Parameter message: The message to append.
    func appendMessage(_ message: CachedMessage) {
        let conversationId = message.conversationId

        if messages[conversationId] == nil {
            messages[conversationId] = []
        }

        messages[conversationId]?.append(message)

        // Trim oldest if over capacity
        if let count = messages[conversationId]?.count,
           count > maxMessagesPerConversation {
            messages[conversationId]?.removeFirst(count - maxMessagesPerConversation)
        }
    }

    /// Retrieves cached messages for a conversation, ordered by timestamp.
    ///
    /// - Parameter conversationId: The conversation ID.
    /// - Returns: The cached messages, or an empty array if none are cached.
    func getMessages(forConversation conversationId: String) -> [CachedMessage] {
        messages[conversationId] ?? []
    }

    // MARK: - Cache Management

    /// Removes all conversations and messages from the cache.
    func clearAll() {
        conversationOrder.removeAll()
        conversations.removeAll()
        messages.removeAll()
        logger.info("Conversation cache cleared")
    }

    /// The current number of cached conversations.
    var conversationCount: Int {
        conversations.count
    }

    /// The total number of cached messages across all conversations.
    var totalMessageCount: Int {
        messages.values.reduce(0) { $0 + $1.count }
    }
}
