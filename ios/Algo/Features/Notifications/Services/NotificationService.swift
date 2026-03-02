// NotificationService.swift
// Algo
//
// Service layer for notification-related API calls.
// Handles fetching, reading, and managing notifications.

import Foundation

// MARK: - NotificationServiceProtocol

/// Protocol defining notification data operations.
/// Enables dependency injection and testing with mock implementations.
protocol NotificationServiceProtocol: Sendable {

    /// Fetches a paginated list of notifications.
    /// - Parameters:
    ///   - page: Page number (1-indexed).
    ///   - unreadOnly: When `true`, returns only unread notifications.
    /// - Returns: A `NotificationListResponse` containing notifications and unread count.
    func getNotifications(page: Int, unreadOnly: Bool) async throws -> NotificationListResponse

    /// Marks a single notification as read.
    /// - Parameter id: The notification identifier.
    func markAsRead(id: String) async throws

    /// Marks all notifications as read.
    func markAllAsRead() async throws
}

// MARK: - NotificationService

/// Production implementation of `NotificationServiceProtocol`.
/// Communicates with the Algo backend REST API.
final class NotificationService: NotificationServiceProtocol {

    // MARK: Properties

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?

    // MARK: Initialization

    /// Creates a new `NotificationService`.
    /// - Parameters:
    ///   - baseURL: The base URL for the Algo API.
    ///   - session: The URL session to use for requests. Defaults to `.shared`.
    ///   - tokenProvider: A closure that returns the current JWT access token.
    init(
        baseURL: URL = URL(string: "https://api.algo.algonit.com/v1")!,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    // MARK: NotificationServiceProtocol

    func getNotifications(page: Int, unreadOnly: Bool) async throws -> NotificationListResponse {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("notifications"),
            resolvingAgainstBaseURL: false
        )!

        components.queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "20"),
            URLQueryItem(name: "unread_only", value: unreadOnly ? "true" : "false")
        ]

        guard let url = components.url else {
            throw NotificationServiceError.invalidURL
        }

        let request = try makeAuthorizedRequest(url: url, method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(NotificationListResponse.self, from: data)
    }

    func markAsRead(id: String) async throws {
        let url = baseURL.appendingPathComponent("notifications/\(id)/read")
        let request = try makeAuthorizedRequest(url: url, method: "POST")
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    func markAllAsRead() async throws {
        let url = baseURL.appendingPathComponent("notifications/read-all")
        let request = try makeAuthorizedRequest(url: url, method: "POST")
        let (_, response) = try await session.data(for: request)
        try validateResponse(response)
    }

    // MARK: Private Helpers

    private func makeAuthorizedRequest(url: URL, method: String) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        guard let token = tokenProvider() else {
            throw NotificationServiceError.unauthorized
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return request
    }

    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NotificationServiceError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw NotificationServiceError.unauthorized
        case 429:
            throw NotificationServiceError.rateLimited
        case 500...599:
            throw NotificationServiceError.serverError(httpResponse.statusCode)
        default:
            throw NotificationServiceError.httpError(httpResponse.statusCode)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        return try decoder.decode(type, from: data)
    }
}

// MARK: - NotificationServiceError

/// Errors specific to notification service operations.
enum NotificationServiceError: LocalizedError {
    case unauthorized
    case invalidURL
    case invalidResponse
    case rateLimited
    case serverError(Int)
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please log in again."
        case .invalidURL:
            return "Invalid request URL."
        case .invalidResponse:
            return "Received an unexpected response from the server."
        case .rateLimited:
            return "Too many requests. Please wait a moment."
        case .serverError(let code):
            return "Server error (\(code)). Please try again later."
        case .httpError(let code):
            return "Request failed with status \(code)."
        }
    }
}
