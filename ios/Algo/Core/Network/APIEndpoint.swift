// APIEndpoint.swift
// Algo
//
// Defines all REST API endpoints for the Algo backend.
// Each case provides its HTTP path, method, and authentication requirement.

import Foundation

/// Enumerates every REST API endpoint in the Algo backend.
///
/// Usage:
/// ```swift
/// let endpoint = APIEndpoint.chatMessage
/// print(endpoint.path)        // "/chat/message"
/// print(endpoint.httpMethod)  // "POST"
/// print(endpoint.requiresAuth) // true
/// ```
enum APIEndpoint {

    // MARK: - Auth

    /// POST /auth/login - Authenticate with email and password.
    case login

    /// POST /auth/refresh - Exchange a refresh token for a new access token.
    case refresh

    /// POST /auth/logout - Invalidate the current session.
    case logout

    /// POST /auth/register - Create a new user account.
    case register

    // MARK: - Chat

    /// POST /chat/message - Send a text or voice message to the AI assistant.
    case chatMessage

    /// POST /chat/confirm - Confirm or cancel a pending action.
    case chatConfirm

    /// GET /chat/conversations - List the user's conversations.
    case conversations

    /// GET /chat/conversations/:id/messages - Retrieve messages for a conversation.
    case conversationMessages(conversationId: String)

    /// DELETE /chat/conversations/:id - Archive a conversation.
    case archiveConversation(conversationId: String)

    /// GET /chat/suggestions - Get contextual conversation suggestions.
    case suggestions

    /// GET /chat/budget - Check remaining AI token budget.
    case budget

    // MARK: - Dashboard

    /// GET /dashboard/summary - Fetch the dashboard metrics summary.
    case dashboardSummary

    /// GET /dashboard/alerts - Fetch active dashboard alerts.
    case dashboardAlerts

    // MARK: - Audio

    /// POST /audio/upload - Upload an audio recording for transcription.
    case audioUpload

    /// POST /audio/tts - Request text-to-speech audio generation.
    case audioTTS

    // MARK: - Devices

    /// POST /devices/register - Register a device for push notifications.
    case deviceRegister

    /// DELETE /devices/unregister - Remove a device's push notification registration.
    case deviceUnregister

    // MARK: - Notifications

    /// GET /notifications - List notifications with optional filtering.
    case notificationsList

    /// POST /notifications/:id/read - Mark a single notification as read.
    case notificationMarkRead(notificationId: String)

    /// POST /notifications/read-all - Mark all notifications as read.
    case notificationMarkAllRead

    /// GET /notifications/settings - Retrieve notification preferences.
    case notificationSettings

    /// PUT /notifications/settings - Update notification preferences.
    case notificationUpdateSettings

    // MARK: - Growth

    /// GET /recommendations - Fetch AI-generated growth recommendations.
    case recommendations

    /// POST /recommendations/:id/accept - Accept a recommendation for execution.
    case recommendationAccept(recommendationId: String)

    /// POST /recommendations/:id/dismiss - Dismiss a recommendation.
    case recommendationDismiss(recommendationId: String)

    /// GET /recommendations/history - Fetch execution history.
    case recommendationHistory

    /// GET /recommendations/safety - Fetch safety limiter status.
    case recommendationSafety

    // MARK: - Admin

    /// GET /admin/llm-health - Check LLM provider health status.
    case llmHealth
}

// MARK: - Endpoint Properties

extension APIEndpoint {

    /// The URL path relative to the base URL (e.g., "/chat/message").
    var path: String {
        switch self {
        // Auth
        case .login:                                return "/auth/login"
        case .refresh:                              return "/auth/refresh"
        case .logout:                               return "/auth/logout"
        case .register:                             return "/auth/register"

        // Chat
        case .chatMessage:                          return "/chat/message"
        case .chatConfirm:                          return "/chat/confirm"
        case .conversations:                        return "/chat/conversations"
        case .conversationMessages(let id):         return "/chat/conversations/\(id)/messages"
        case .archiveConversation(let id):           return "/chat/conversations/\(id)"
        case .suggestions:                          return "/chat/suggestions"
        case .budget:                               return "/chat/budget"

        // Dashboard
        case .dashboardSummary:                     return "/dashboard/summary"
        case .dashboardAlerts:                      return "/dashboard/alerts"

        // Audio
        case .audioUpload:                          return "/audio/upload"
        case .audioTTS:                             return "/audio/tts"

        // Devices
        case .deviceRegister:                       return "/devices/register"
        case .deviceUnregister:                     return "/devices/unregister"

        // Notifications
        case .notificationsList:                    return "/notifications"
        case .notificationMarkRead(let id):         return "/notifications/\(id)/read"
        case .notificationMarkAllRead:              return "/notifications/read-all"
        case .notificationSettings:                 return "/notifications/settings"
        case .notificationUpdateSettings:           return "/notifications/settings"

        // Growth
        case .recommendations:                      return "/recommendations"
        case .recommendationAccept(let id):         return "/recommendations/\(id)/accept"
        case .recommendationDismiss(let id):        return "/recommendations/\(id)/dismiss"
        case .recommendationHistory:                return "/recommendations/history"
        case .recommendationSafety:                 return "/recommendations/safety"

        // Admin
        case .llmHealth:                            return "/admin/llm-health"
        }
    }

    /// The HTTP method for this endpoint (GET, POST, PUT, DELETE).
    var httpMethod: String {
        switch self {
        case .login, .refresh, .logout, .register:
            return "POST"
        case .chatMessage, .chatConfirm:
            return "POST"
        case .conversations, .conversationMessages, .suggestions, .budget:
            return "GET"
        case .dashboardSummary, .dashboardAlerts:
            return "GET"
        case .audioUpload, .audioTTS:
            return "POST"
        case .deviceRegister:
            return "POST"
        case .deviceUnregister, .archiveConversation:
            return "DELETE"
        case .notificationsList:
            return "GET"
        case .notificationMarkRead, .notificationMarkAllRead:
            return "POST"
        case .notificationSettings:
            return "GET"
        case .notificationUpdateSettings:
            return "PUT"
        case .recommendations, .recommendationHistory, .recommendationSafety:
            return "GET"
        case .recommendationAccept, .recommendationDismiss:
            return "POST"
        case .llmHealth:
            return "GET"
        }
    }

    /// Whether this endpoint requires a valid Bearer token in the Authorization header.
    ///
    /// Login, register, and token refresh do not require authentication.
    var requiresAuth: Bool {
        switch self {
        case .login, .register, .refresh:
            return false
        default:
            return true
        }
    }

    /// Builds the full `URL` by appending this endpoint's path to the given base URL,
    /// optionally including query parameters.
    ///
    /// - Parameters:
    ///   - baseURL: The API base URL (e.g., `AppConfiguration.baseURL`).
    ///   - queryItems: Optional query parameters to append.
    /// - Returns: The fully constructed `URL`.
    func url(baseURL: URL, queryItems: [URLQueryItem]? = nil) -> URL {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if let queryItems, !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        return components.url!
    }
}
