// DashboardService.swift
// Algo
//
// Service layer for dashboard-related API calls.
// Fetches summary metrics and alerts from the Algo backend.

import Foundation

// MARK: - DashboardServiceProtocol

/// Protocol defining dashboard data operations.
/// Enables dependency injection and testing with mock implementations.
protocol DashboardServiceProtocol: Sendable {

    /// Fetches the complete dashboard summary including metrics and alerts.
    /// - Returns: A `DashboardSummary` containing the current period's data.
    /// - Throws: `APIError` if the request fails.
    func getSummary() async throws -> DashboardSummary

    /// Fetches only the active alerts.
    /// - Returns: An array of `AlertItem` sorted by creation time (newest first).
    /// - Throws: `APIError` if the request fails.
    func getAlerts() async throws -> [AlertItem]
}

// MARK: - DashboardService

/// Production implementation of `DashboardServiceProtocol`.
/// Communicates with the Algo backend REST API.
final class DashboardService: DashboardServiceProtocol {

    // MARK: Properties

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?

    // MARK: Initialization

    /// Creates a new `DashboardService`.
    /// - Parameters:
    ///   - baseURL: The base URL for the Algo API (e.g., `https://api.algo.algonit.com/v1`).
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

    // MARK: DashboardServiceProtocol

    func getSummary() async throws -> DashboardSummary {
        let url = baseURL.appendingPathComponent("dashboard/summary")
        let request = try makeAuthorizedRequest(url: url)
        let (data, response) = try await session.data(for: request)
        try validateResponse(response)
        return try decode(DashboardSummary.self, from: data)
    }

    func getAlerts() async throws -> [AlertItem] {
        // Alerts are included in the summary endpoint.
        // If a dedicated alerts endpoint is added, this can be updated.
        let summary = try await getSummary()
        return summary.alerts
    }

    // MARK: Private Helpers

    /// Constructs an authorized GET request with required headers.
    private func makeAuthorizedRequest(url: URL) throws -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        guard let token = tokenProvider() else {
            throw DashboardError.unauthorized
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return request
    }

    /// Validates the HTTP response status code.
    private func validateResponse(_ response: URLResponse) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw DashboardError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw DashboardError.unauthorized
        case 429:
            throw DashboardError.rateLimited
        case 500...599:
            throw DashboardError.serverError(httpResponse.statusCode)
        default:
            throw DashboardError.httpError(httpResponse.statusCode)
        }
    }

    /// Decodes JSON data into the specified type using snake_case key conversion.
    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
        return try decoder.decode(type, from: data)
    }
}

// MARK: - DashboardError

/// Errors specific to dashboard service operations.
enum DashboardError: LocalizedError {
    case unauthorized
    case invalidResponse
    case rateLimited
    case serverError(Int)
    case httpError(Int)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Your session has expired. Please log in again."
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
