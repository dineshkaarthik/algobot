// AuthInterceptor.swift
// Algo
//
// Handles automatic JWT token injection into outgoing requests and
// transparent token refresh on 401 responses.
//
// Thread-safe: concurrent 401 responses are coalesced into a single
// refresh request. All waiting callers receive the new token once
// the refresh completes.

import Foundation
import os

/// Intercepts HTTP requests to inject authentication tokens and handle token refresh.
///
/// This interceptor is designed to be used by `APIClient` to transparently manage
/// the authentication lifecycle:
///
/// 1. **Token Injection**: Adds `Authorization: Bearer <token>` to requests.
/// 2. **401 Handling**: Detects expired tokens and triggers a refresh.
/// 3. **Coalescing**: Multiple concurrent 401s produce only one refresh call.
/// 4. **Token Storage**: Persists new tokens via `KeychainManager`.
///
/// Usage:
/// ```swift
/// let interceptor = AuthInterceptor(keychainManager: keychain, baseURL: config.baseURL)
/// let authedRequest = interceptor.authenticate(request)
/// ```
actor AuthInterceptor {

    // MARK: - Dependencies

    private let keychainManager: KeychainManager
    private let baseURL: URL

    // MARK: - State

    /// Whether a token refresh is currently in flight.
    private var isRefreshing = false

    /// Continuations from callers waiting for the in-flight refresh to complete.
    private var pendingRefreshContinuations: [CheckedContinuation<String, Error>] = []

    private let logger = Logger(subsystem: "com.algonit.algo", category: "AuthInterceptor")

    // MARK: - Initialization

    /// Creates a new `AuthInterceptor`.
    ///
    /// - Parameters:
    ///   - keychainManager: The keychain manager for reading and storing tokens.
    ///   - baseURL: The base URL for the token refresh endpoint.
    init(keychainManager: KeychainManager, baseURL: URL) {
        self.keychainManager = keychainManager
        self.baseURL = baseURL
    }

    // MARK: - Token Injection

    /// Adds the stored access token to the request's `Authorization` header.
    ///
    /// Also injects the `X-Tenant-ID` and `X-Request-ID` headers if available.
    ///
    /// - Parameter request: The outgoing `URLRequest` to authenticate.
    /// - Returns: A new `URLRequest` with auth headers attached.
    func authenticate(_ request: URLRequest) -> URLRequest {
        var mutableRequest = request

        if let token = keychainManager.getToken() {
            mutableRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let tenantID = keychainManager.getTenantID() {
            mutableRequest.setValue(tenantID, forHTTPHeaderField: "X-Tenant-ID")
        }

        // Unique request ID for tracing
        mutableRequest.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        return mutableRequest
    }

    // MARK: - Token Refresh

    /// Attempts to refresh the access token.
    ///
    /// If a refresh is already in progress, this call suspends until the in-flight
    /// refresh completes, then returns the new token. This ensures only one refresh
    /// request is made regardless of how many concurrent 401 responses are received.
    ///
    /// - Returns: The new access token on success.
    /// - Throws: `APIError.unauthorized` if the refresh fails (e.g., refresh token expired).
    func refreshToken() async throws -> String {
        // If a refresh is already in flight, queue this caller
        if isRefreshing {
            logger.debug("Refresh already in progress, queuing caller")
            return try await withCheckedThrowingContinuation { continuation in
                pendingRefreshContinuations.append(continuation)
            }
        }

        isRefreshing = true
        logger.info("Starting token refresh")

        do {
            let newToken = try await performTokenRefresh()

            // Store the new token
            try keychainManager.saveToken(newToken)
            logger.info("Token refresh succeeded")

            // Resume all waiting callers with the new token
            let waitingContinuations = pendingRefreshContinuations
            pendingRefreshContinuations.removeAll()
            isRefreshing = false

            for continuation in waitingContinuations {
                continuation.resume(returning: newToken)
            }

            return newToken

        } catch {
            logger.error("Token refresh failed: \(error.localizedDescription)")

            // Resume all waiting callers with the error
            let waitingContinuations = pendingRefreshContinuations
            pendingRefreshContinuations.removeAll()
            isRefreshing = false

            for continuation in waitingContinuations {
                continuation.resume(throwing: error)
            }

            throw error
        }
    }

    // MARK: - Private

    /// Executes the actual HTTP token refresh request.
    ///
    /// - Returns: The new access token string.
    /// - Throws: `APIError.unauthorized` if the refresh token is invalid or expired.
    private func performTokenRefresh() async throws -> String {
        guard let refreshToken = keychainManager.getRefreshToken() else {
            throw APIError.unauthorized
        }

        let endpoint = APIEndpoint.refresh
        let url = endpoint.url(baseURL: baseURL)

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.httpMethod
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["refresh_token": refreshToken]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid response during token refresh")
        }

        guard httpResponse.statusCode == 200 else {
            // Refresh token is expired or invalid - user must re-authenticate
            keychainManager.clearAll()
            throw APIError.unauthorized
        }

        struct RefreshResponse: Decodable {
            let accessToken: String
            let expiresIn: Int
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        do {
            let refreshResponse = try decoder.decode(RefreshResponse.self, from: data)
            return refreshResponse.accessToken
        } catch {
            throw APIError.decodingError("Failed to decode refresh token response: \(error.localizedDescription)")
        }
    }
}
