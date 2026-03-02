// Conversation.swift
// Algo
//
// Conversation model representing a chat session, along with
// pagination and list response types for the conversations API.

import Foundation

// MARK: - Conversation

struct Conversation: Codable, Identifiable, Sendable, Equatable {

    let id: String
    let title: String?
    let lastMessage: String?
    let messageCount: Int
    let createdAt: Date
    let updatedAt: Date
    var isArchived: Bool

    init(
        id: String,
        title: String? = nil,
        lastMessage: String? = nil,
        messageCount: Int = 0,
        createdAt: Date = .now,
        updatedAt: Date = .now,
        isArchived: Bool = false
    ) {
        self.id = id
        self.title = title
        self.lastMessage = lastMessage
        self.messageCount = messageCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isArchived = isArchived
    }

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case lastMessage = "last_message"
        case messageCount = "message_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case isArchived = "is_archived"
    }
}

// MARK: - Conversation Convenience Properties

extension Conversation {

    /// A display-friendly title, falling back to "New Conversation" if nil.
    var displayTitle: String {
        title ?? "New Conversation"
    }

    /// A formatted relative time string for the last update (e.g. "2 hours ago").
    var relativeTimeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: updatedAt, relativeTo: .now)
    }

    /// A short preview of the last message, truncated for list display.
    var messagePreview: String? {
        guard let lastMessage, !lastMessage.isEmpty else { return nil }
        if lastMessage.count > 100 {
            return String(lastMessage.prefix(100)) + "..."
        }
        return lastMessage
    }
}

// MARK: - ConversationListResponse

/// Response from GET /chat/conversations.
struct ConversationListResponse: Codable, Sendable {
    let conversations: [Conversation]
    let pagination: Pagination
}

// MARK: - Pagination

struct Pagination: Codable, Sendable, Equatable {
    let page: Int
    let limit: Int
    let total: Int?
    let hasMore: Bool?

    enum CodingKeys: String, CodingKey {
        case page
        case limit
        case total
        case hasMore = "has_more"
    }

    /// Whether there are more pages available.
    var canLoadMore: Bool {
        hasMore ?? false
    }
}
