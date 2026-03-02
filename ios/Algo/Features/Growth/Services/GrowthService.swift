// GrowthService.swift
// Algo
//
// Service layer for Growth Copilot API calls.
// Fetches recommendations, submits accept/dismiss actions,
// retrieves execution history, and checks safety limiter status.

import Foundation

// MARK: - GrowthServiceProtocol

/// Protocol defining Growth Copilot data operations.
/// Enables dependency injection and testing with mock implementations.
protocol GrowthServiceProtocol: Sendable {

    /// Fetches AI-generated growth recommendations.
    /// - Parameter limit: Maximum number of recommendations to return.
    /// - Returns: A `RecommendationsResponse` containing the recommendations list.
    /// - Throws: `GrowthServiceError` if the request fails.
    func getRecommendations(limit: Int) async throws -> RecommendationsResponse

    /// Accepts a recommendation for execution.
    /// - Parameter id: The recommendation identifier.
    /// - Returns: An `AcceptResponse` with the confirmation ID and status.
    /// - Throws: `GrowthServiceError` if the request fails.
    func acceptRecommendation(id: String) async throws -> AcceptResponse

    /// Dismisses a recommendation.
    /// - Parameter id: The recommendation identifier.
    /// - Returns: A `DismissResponse` with the updated status.
    /// - Throws: `GrowthServiceError` if the request fails.
    func dismissRecommendation(id: String) async throws -> DismissResponse

    /// Fetches the history of executed recommendation actions.
    /// - Parameter limit: Maximum number of entries to return.
    /// - Returns: An `ExecutionHistoryResponse` with the execution log.
    /// - Throws: `GrowthServiceError` if the request fails.
    func getExecutionHistory(limit: Int) async throws -> ExecutionHistoryResponse

    /// Fetches the current safety limiter status.
    /// - Returns: A `SafetyStatus` with current usage and limits.
    /// - Throws: `GrowthServiceError` if the request fails.
    func getSafetyStatus() async throws -> SafetyStatus
}

// MARK: - GrowthService

/// Production implementation of `GrowthServiceProtocol`.
/// Communicates with the Algo backend REST API.
final class GrowthService: GrowthServiceProtocol {

    // MARK: Properties

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?

    // MARK: Initialization

    /// Creates a new `GrowthService`.
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

    // MARK: GrowthServiceProtocol

    func getRecommendations(limit: Int) async throws -> RecommendationsResponse {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("recommendations"),
            resolvingAgainstBaseURL: false
        )!

        components.queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)")
        ]

        guard let url = components.url else {
            throw GrowthServiceError.invalidURL
        }

        let request = try makeAuthorizedRequest(url: url, method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(RecommendationsResponse.self, from: data)
    }

    func acceptRecommendation(id: String) async throws -> AcceptResponse {
        let url = baseURL.appendingPathComponent("recommendations/\(id)/accept")
        let request = try makeAuthorizedRequest(url: url, method: "POST")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(AcceptResponse.self, from: data)
    }

    func dismissRecommendation(id: String) async throws -> DismissResponse {
        let url = baseURL.appendingPathComponent("recommendations/\(id)/dismiss")
        let request = try makeAuthorizedRequest(url: url, method: "POST")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(DismissResponse.self, from: data)
    }

    func getExecutionHistory(limit: Int) async throws -> ExecutionHistoryResponse {
        var components = URLComponents(
            url: baseURL.appendingPathComponent("recommendations/history"),
            resolvingAgainstBaseURL: false
        )!

        components.queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)")
        ]

        guard let url = components.url else {
            throw GrowthServiceError.invalidURL
        }

        let request = try makeAuthorizedRequest(url: url, method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(ExecutionHistoryResponse.self, from: data)
    }

    func getSafetyStatus() async throws -> SafetyStatus {
        let url = baseURL.appendingPathComponent("recommendations/safety")
        let request = try makeAuthorizedRequest(url: url, method: "GET")
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(SafetyStatus.self, from: data)
    }

    // MARK: Private Helpers

    /// Constructs an authorized request with required headers.
    private func makeAuthorizedRequest(url: URL, method: String) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        guard let token = tokenProvider() else {
            throw GrowthServiceError.unauthorized
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return request
    }

    /// Validates the HTTP response status code.
    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw GrowthServiceError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw GrowthServiceError.unauthorized
        case 429:
            throw GrowthServiceError.rateLimited
        case 500...599:
            throw GrowthServiceError.serverError(httpResponse.statusCode)
        default:
            throw GrowthServiceError.httpError(httpResponse.statusCode)
        }
    }

    /// Decodes JSON data into the specified type.
    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        return try decoder.decode(type, from: data)
    }
}

// MARK: - GrowthServiceError

/// Errors specific to growth service operations.
enum GrowthServiceError: LocalizedError {
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
            return "Too many requests. Please wait a moment and try again."
        case .serverError(let code):
            return "Server error (\(code)). Please try again later."
        case .httpError(let code):
            return "Request failed with status \(code)."
        }
    }
}
