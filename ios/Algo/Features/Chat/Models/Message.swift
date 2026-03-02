// Message.swift
// Algo
//
// Chat message model representing a single message in a conversation
// between the user, assistant, or system.

import Foundation

// MARK: - Message

struct Message: Codable, Identifiable, Sendable, Equatable {

    let id: String
    let role: MessageRole
    let content: String
    let inputType: String?
    let structuredData: StructuredData?
    let suggestedActions: [SuggestedAction]?
    let intent: String?
    let requiresConfirmation: Bool?
    let confirmationId: String?
    let timestamp: Date

    init(
        id: String = "msg_\(UUID().uuidString.prefix(8))",
        role: MessageRole,
        content: String,
        inputType: String? = "text",
        structuredData: StructuredData? = nil,
        suggestedActions: [SuggestedAction]? = nil,
        intent: String? = nil,
        requiresConfirmation: Bool? = false,
        confirmationId: String? = nil,
        timestamp: Date = .now
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.inputType = inputType
        self.structuredData = structuredData
        self.suggestedActions = suggestedActions
        self.intent = intent
        self.requiresConfirmation = requiresConfirmation
        self.confirmationId = confirmationId
        self.timestamp = timestamp
    }

    enum CodingKeys: String, CodingKey {
        case id
        case role
        case content
        case inputType = "input_type"
        case structuredData = "structured_data"
        case suggestedActions = "suggested_actions"
        case intent
        case requiresConfirmation = "requires_confirmation"
        case confirmationId = "confirmation_id"
        case timestamp
    }
}

// MARK: - Message Convenience Properties

extension Message {

    var isUser: Bool { role == .user }
    var isAssistant: Bool { role == .assistant }
    var isSystem: Bool { role == .system }

    /// Whether this message is a voice input.
    var isVoiceInput: Bool { inputType == "voice" }

    /// Whether this message requires the user to confirm an action.
    var needsConfirmation: Bool { requiresConfirmation == true && confirmationId != nil }

    /// Whether this message contains structured data for rich rendering.
    var hasStructuredData: Bool { structuredData != nil }

    /// Whether this message has suggested follow-up actions.
    var hasSuggestedActions: Bool {
        guard let actions = suggestedActions else { return false }
        return !actions.isEmpty
    }
}

// MARK: - MessageRole

enum MessageRole: String, Codable, Sendable {
    case user
    case assistant
    case system
}
