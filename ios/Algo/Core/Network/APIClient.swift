// APIClient.swift
// Algo
//
// Base HTTP client for all Algo API communication.
// Built on URLSession with async/await, automatic token injection,
// transparent 401 refresh, snake_case JSON decoding, multipart upload,
// and configurable timeouts.

import Foundation
import os

/// The primary HTTP client for communicating with the Algo backend.
///
/// `APIClient` wraps `URLSession` with:
/// - Automatic JWT token injection via `AuthInterceptor`
/// - Transparent token refresh on 401 responses (single retry)
/// - JSON encoding/decoding with `snake_case` key strategy
/// - Multipart form-data upload for audio files
/// - Request/response logging in DEBUG builds
///
/// Usage:
/// ```swift
/// let client = APIClient(keychainManager: keychain)
/// let summary: DashboardSummary = try await client.get(.dashboardSummary)
/// ```
final class APIClient: Sendable {

    // MARK: - Properties

    private let session: URLSession
    private let baseURL: URL
    private let authInterceptor: AuthInterceptor
    private let keychainManager: KeychainManager

    private let jsonEncoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private let jsonDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private let logger = Logger(subsystem: "com.algonit.algo", category: "APIClient")

    /// Callback invoked when authentication fails irrecoverably (refresh token expired).
    /// The app should respond by navigating the user to the login screen.
    var onAuthenticationFailure: (@Sendable () -> Void)?

    // MARK: - Initialization

    /// Creates a new `APIClient`.
    ///
    /// - Parameters:
    ///   - baseURL: The API base URL. Defaults to `AppConfiguration.baseURL`.
    ///   - keychainManager: The keychain manager for token storage.
    ///   - timeoutInterval: The default request timeout in seconds.
    init(
        baseURL: URL = AppConfiguration.baseURL,
        keychainManager: KeychainManager,
        timeoutInterval: TimeInterval = AppConfiguration.requestTimeout
    ) {
        self.baseURL = baseURL
        self.keychainManager = keychainManager
        self.authInterceptor = AuthInterceptor(keychainManager: keychainManager, baseURL: baseURL)

        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = timeoutInterval
        configuration.timeoutIntervalForResource = AppConfiguration.uploadTimeout
        configuration.httpAdditionalHeaders = [
            "Accept": "application/json",
            "User-Agent": "Algo-iOS/\(AppConfiguration.appVersion)"
        ]
        self.session = URLSession(configuration: configuration)
    }

    // MARK: - Generic Request Methods

    /// Performs a GET request and decodes the response.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to call.
    ///   - queryItems: Optional query parameters.
    /// - Returns: The decoded response of type `T`.
    /// - Throws: `APIError` on failure.
    func get<T: Decodable>(
        _ endpoint: APIEndpoint,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        let request = try buildRequest(endpoint: endpoint, queryItems: queryItems)
        return try await execute(request, endpoint: endpoint)
    }

    /// Performs a POST request with a JSON body and decodes the response.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to call.
    ///   - body: The request body to encode as JSON. Pass `nil` for no body.
    ///   - queryItems: Optional query parameters.
    /// - Returns: The decoded response of type `T`.
    /// - Throws: `APIError` on failure.
    func post<T: Decodable, B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B?,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, queryItems: queryItems)
        if let body {
            request.httpBody = try jsonEncoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request, endpoint: endpoint)
    }

    /// Performs a POST request with a JSON body, discarding the response body.
    ///
    /// Useful for fire-and-forget endpoints that return `{ "status": "ok" }`.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to call.
    ///   - body: The request body to encode as JSON. Pass `nil` for no body.
    /// - Throws: `APIError` on failure.
    func post<B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B?
    ) async throws {
        var request = try buildRequest(endpoint: endpoint)
        if let body {
            request.httpBody = try jsonEncoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        try await executeVoid(request, endpoint: endpoint)
    }

    /// Performs a PUT request with a JSON body and decodes the response.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to call.
    ///   - body: The request body to encode as JSON.
    ///   - queryItems: Optional query parameters.
    /// - Returns: The decoded response of type `T`.
    /// - Throws: `APIError` on failure.
    func put<T: Decodable, B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, queryItems: queryItems)
        request.httpBody = try jsonEncoder.encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request, endpoint: endpoint)
    }

    /// Performs a DELETE request and decodes the response.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to call.
    ///   - body: Optional request body.
    ///   - queryItems: Optional query parameters.
    /// - Returns: The decoded response of type `T`.
    /// - Throws: `APIError` on failure.
    func delete<T: Decodable, B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B? = Optional<EmptyBody>.none,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        var request = try buildRequest(endpoint: endpoint, queryItems: queryItems)
        if let body {
            request.httpBody = try jsonEncoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return try await execute(request, endpoint: endpoint)
    }

    /// Performs a DELETE request, discarding the response body.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint to call.
    ///   - body: Optional request body.
    /// - Throws: `APIError` on failure.
    func delete<B: Encodable>(
        _ endpoint: APIEndpoint,
        body: B? = Optional<EmptyBody>.none
    ) async throws {
        var request = try buildRequest(endpoint: endpoint)
        if let body {
            request.httpBody = try jsonEncoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        try await executeVoid(request, endpoint: endpoint)
    }

    // MARK: - Multipart Upload

    /// Uploads a file using multipart/form-data encoding.
    ///
    /// Designed for audio file uploads to the `/audio/upload` endpoint.
    ///
    /// - Parameters:
    ///   - endpoint: The API endpoint (typically `.audioUpload`).
    ///   - fileURL: The local file URL of the audio file.
    ///   - fileName: The filename to include in the multipart header.
    ///   - mimeType: The MIME type of the file (e.g., "audio/m4a").
    ///   - fieldName: The form field name for the file. Defaults to "audio".
    ///   - additionalFields: Extra string fields to include in the form data.
    /// - Returns: The decoded response of type `T`.
    /// - Throws: `APIError` on failure.
    func upload<T: Decodable>(
        _ endpoint: APIEndpoint,
        fileURL: URL,
        fileName: String,
        mimeType: String,
        fieldName: String = "audio",
        additionalFields: [String: String] = [:]
    ) async throws -> T {
        let boundary = "Algo-Boundary-\(UUID().uuidString)"
        var request = try buildRequest(endpoint: endpoint)
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = AppConfiguration.uploadTimeout

        let fileData = try Data(contentsOf: fileURL)
        var body = Data()

        // Add file field
        body.appendMultipartFile(
            boundary: boundary,
            fieldName: fieldName,
            fileName: fileName,
            mimeType: mimeType,
            data: fileData
        )

        // Add additional string fields
        for (key, value) in additionalFields {
            body.appendMultipartField(boundary: boundary, fieldName: key, value: value)
        }

        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        return try await execute(request, endpoint: endpoint)
    }

    // MARK: - Request Building

    /// Constructs a `URLRequest` for the given endpoint.
    private func buildRequest(
        endpoint: APIEndpoint,
        queryItems: [URLQueryItem]? = nil
    ) throws -> URLRequest {
        let url = endpoint.url(baseURL: baseURL, queryItems: queryItems)
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.httpMethod
        return request
    }

    // MARK: - Execution

    /// Executes a request, handling auth injection, 401 retry, and JSON decoding.
    private func execute<T: Decodable>(
        _ request: URLRequest,
        endpoint: APIEndpoint
    ) async throws -> T {
        let (data, _) = try await performRequest(request, endpoint: endpoint)

        do {
            return try jsonDecoder.decode(T.self, from: data)
        } catch let decodingError {
            logError("Decoding failed for \(endpoint.path): \(decodingError)")
            throw APIError.decodingError(
                "Failed to decode \(T.self): \(decodingError.localizedDescription)"
            )
        }
    }

    /// Executes a request that returns no meaningful body (just validates status).
    private func executeVoid(
        _ request: URLRequest,
        endpoint: APIEndpoint
    ) async throws {
        _ = try await performRequest(request, endpoint: endpoint)
    }

    /// Core request execution with auth injection, logging, and 401 retry logic.
    ///
    /// - Returns: A tuple of the response body data and the HTTP response.
    private func performRequest(
        _ request: URLRequest,
        endpoint: APIEndpoint
    ) async throws -> (Data, HTTPURLResponse) {
        // Inject auth headers if the endpoint requires authentication
        var authedRequest = request
        if endpoint.requiresAuth {
            authedRequest = await authInterceptor.authenticate(request)
        }

        logRequest(authedRequest)

        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: authedRequest)
        } catch let urlError as URLError {
            throw APIError.networkError(urlError.localizedDescription)
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }

        logResponse(httpResponse, data: data, endpoint: endpoint)

        // Handle 401 with automatic token refresh (single retry)
        if httpResponse.statusCode == 401 && endpoint.requiresAuth {
            return try await handleUnauthorized(
                originalRequest: request,
                endpoint: endpoint
            )
        }

        // Validate status code for all other responses
        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.from(statusCode: httpResponse.statusCode, data: data)
        }

        return (data, httpResponse)
    }

    /// Handles a 401 response by refreshing the token and retrying the request once.
    private func handleUnauthorized(
        originalRequest: URLRequest,
        endpoint: APIEndpoint
    ) async throws -> (Data, HTTPURLResponse) {
        do {
            let newToken = try await authInterceptor.refreshToken()

            // Retry the original request with the new token
            var retryRequest = originalRequest
            retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
            if let tenantID = keychainManager.getTenantID() {
                retryRequest.setValue(tenantID, forHTTPHeaderField: "X-Tenant-ID")
            }
            retryRequest.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

            logRequest(retryRequest, isRetry: true)

            let (retryData, retryResponse) = try await session.data(for: retryRequest)

            guard let retryHttpResponse = retryResponse as? HTTPURLResponse else {
                throw APIError.networkError("Invalid HTTP response on retry")
            }

            logResponse(retryHttpResponse, data: retryData, endpoint: endpoint, isRetry: true)

            // If still 401 after refresh, the user must re-authenticate
            if retryHttpResponse.statusCode == 401 {
                keychainManager.clearAll()
                onAuthenticationFailure?()
                throw APIError.unauthorized
            }

            guard (200...299).contains(retryHttpResponse.statusCode) else {
                throw APIError.from(statusCode: retryHttpResponse.statusCode, data: retryData)
            }

            return (retryData, retryHttpResponse)

        } catch let error as APIError where error == .unauthorized {
            keychainManager.clearAll()
            onAuthenticationFailure?()
            throw error
        }
    }

    // MARK: - Logging

    private func logRequest(_ request: URLRequest, isRetry: Bool = false) {
        #if DEBUG
        let prefix = isRetry ? "[RETRY]" : "[REQ]"
        logger.debug("\(prefix) \(request.httpMethod ?? "?") \(request.url?.absoluteString ?? "?")")
        if let body = request.httpBody, body.count < 10_000,
           let bodyString = String(data: body, encoding: .utf8) {
            logger.debug("  Body: \(bodyString)")
        }
        #endif
    }

    private func logResponse(
        _ response: HTTPURLResponse,
        data: Data,
        endpoint: APIEndpoint,
        isRetry: Bool = false
    ) {
        #if DEBUG
        let prefix = isRetry ? "[RETRY-RES]" : "[RES]"
        logger.debug("\(prefix) \(response.statusCode) \(endpoint.path)")
        if data.count < 10_000, let bodyString = String(data: data, encoding: .utf8) {
            logger.debug("  Body: \(bodyString.prefix(2000))")
        } else {
            logger.debug("  Body: <\(data.count) bytes>")
        }
        #endif
    }

    private func logError(_ message: String) {
        #if DEBUG
        logger.error("[ERR] \(message)")
        #endif
    }
}

// MARK: - Empty Body

/// A placeholder type for requests that carry no body.
struct EmptyBody: Encodable {}

// MARK: - Data Multipart Helpers

private extension Data {

    /// Appends a file part to a multipart/form-data body.
    mutating func appendMultipartFile(
        boundary: String,
        fieldName: String,
        fileName: String,
        mimeType: String,
        data: Data
    ) {
        var header = "--\(boundary)\r\n"
        header += "Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(fileName)\"\r\n"
        header += "Content-Type: \(mimeType)\r\n\r\n"
        append(header.data(using: .utf8)!)
        append(data)
        append("\r\n".data(using: .utf8)!)
    }

    /// Appends a string field to a multipart/form-data body.
    mutating func appendMultipartField(
        boundary: String,
        fieldName: String,
        value: String
    ) {
        var header = "--\(boundary)\r\n"
        header += "Content-Disposition: form-data; name=\"\(fieldName)\"\r\n\r\n"
        append(header.data(using: .utf8)!)
        append(value.data(using: .utf8)!)
        append("\r\n".data(using: .utf8)!)
    }
}
