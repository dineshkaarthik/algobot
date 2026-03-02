// APIError.swift
// Algo
//
// Defines all API error types with user-friendly localized descriptions.
// Maps HTTP status codes and server error responses to typed Swift errors.

import Foundation

/// Represents all possible errors from the Algo API layer.
///
/// Each case maps to a specific failure mode and provides a user-facing
/// description via `LocalizedError` conformance.
enum APIError: Error, Equatable {
    /// A network-level failure (no connectivity, DNS resolution, TLS, etc.).
    case networkError(String)

    /// HTTP 401 - The access token is missing, expired, or invalid.
    case unauthorized

    /// HTTP 403 - The authenticated user lacks permission for this resource.
    case forbidden

    /// HTTP 404 - The requested resource does not exist.
    case notFound

    /// HTTP 429 - Too many requests. `retryAfter` indicates seconds to wait.
    case rateLimited(retryAfter: Int)

    /// HTTP 5xx - An unexpected server-side error occurred.
    case serverError(statusCode: Int, message: String?)

    /// The response body could not be decoded into the expected type.
    case decodingError(String)

    /// The user's AI token budget has been exhausted for the current billing period.
    case tokenBudgetExhausted(resetInSeconds: Int)

    /// HTTP 400 - The request was malformed or contained invalid parameters.
    case badRequest(String)

    /// HTTP 409 - The action conflicts with the current resource state.
    case conflict(String)

    /// HTTP 422 - Request validation failed.
    case validationError(String)

    /// An unrecognized error that doesn't match any known category.
    case unknown(statusCode: Int?)

    // MARK: - Equatable

    static func == (lhs: APIError, rhs: APIError) -> Bool {
        switch (lhs, rhs) {
        case (.networkError(let a), .networkError(let b)):
            return a == b
        case (.unauthorized, .unauthorized):
            return true
        case (.forbidden, .forbidden):
            return true
        case (.notFound, .notFound):
            return true
        case (.rateLimited(let a), .rateLimited(let b)):
            return a == b
        case (.serverError(let a1, let a2), .serverError(let b1, let b2)):
            return a1 == b1 && a2 == b2
        case (.decodingError(let a), .decodingError(let b)):
            return a == b
        case (.tokenBudgetExhausted(let a), .tokenBudgetExhausted(let b)):
            return a == b
        case (.badRequest(let a), .badRequest(let b)):
            return a == b
        case (.conflict(let a), .conflict(let b)):
            return a == b
        case (.validationError(let a), .validationError(let b)):
            return a == b
        case (.unknown(let a), .unknown(let b)):
            return a == b
        default:
            return false
        }
    }
}

// MARK: - LocalizedError

extension APIError: LocalizedError {

    var errorDescription: String? {
        switch self {
        case .networkError(let message):
            return "Network error: \(message). Please check your connection and try again."

        case .unauthorized:
            return "Your session has expired. Please sign in again."

        case .forbidden:
            return "You don't have permission to perform this action."

        case .notFound:
            return "The requested resource could not be found."

        case .rateLimited(let retryAfter):
            return "Too many requests. Please wait \(retryAfter) seconds before trying again."

        case .serverError(_, let message):
            return message ?? "An unexpected server error occurred. Please try again later."

        case .decodingError:
            return "We received an unexpected response from the server. Please try again."

        case .tokenBudgetExhausted(let resetInSeconds):
            let minutes = resetInSeconds / 60
            return "Your AI credits have been exhausted. They will reset in \(minutes) minutes."

        case .badRequest(let message):
            return "Invalid request: \(message)"

        case .conflict(let message):
            return "Action conflict: \(message)"

        case .validationError(let message):
            return "Validation failed: \(message)"

        case .unknown:
            return "An unexpected error occurred. Please try again."
        }
    }

    var recoverySuggestion: String? {
        switch self {
        case .networkError:
            return "Check your internet connection and try again."
        case .unauthorized:
            return "Sign in to continue using Algo."
        case .rateLimited(let retryAfter):
            return "Wait \(retryAfter) seconds, then retry your request."
        case .tokenBudgetExhausted:
            return "Upgrade your plan or wait for credits to reset."
        default:
            return nil
        }
    }
}

// MARK: - Server Error Response Parsing

extension APIError {

    /// The standard error response body from the Algo backend.
    struct ServerErrorResponse: Decodable {
        let error: ErrorBody
        let requestId: String?
        let timestamp: String?

        struct ErrorBody: Decodable {
            let code: String
            let message: String
            let details: Details?

            struct Details: Decodable {
                let retryAfter: Int?
                let resetInSeconds: Int?
            }
        }
    }

    /// Constructs the appropriate `APIError` from an HTTP status code and optional response body.
    ///
    /// - Parameters:
    ///   - statusCode: The HTTP response status code.
    ///   - data: The raw response body, which may contain a `ServerErrorResponse` JSON object.
    /// - Returns: A typed `APIError` matching the failure.
    static func from(statusCode: Int, data: Data?) -> APIError {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let serverError = data.flatMap { try? decoder.decode(ServerErrorResponse.self, from: $0) }

        switch statusCode {
        case 400:
            return .badRequest(serverError?.error.message ?? "Bad request")
        case 401:
            return .unauthorized
        case 403:
            return .forbidden
        case 404:
            return .notFound
        case 409:
            return .conflict(serverError?.error.message ?? "Conflict")
        case 422:
            return .validationError(serverError?.error.message ?? "Validation failed")
        case 429:
            let retryAfter = serverError?.error.details?.retryAfter ?? 30
            return .rateLimited(retryAfter: retryAfter)
        case 500...599:
            if let details = serverError?.error.details,
               let reset = details.resetInSeconds {
                return .tokenBudgetExhausted(resetInSeconds: reset)
            }
            return .serverError(
                statusCode: statusCode,
                message: serverError?.error.message
            )
        default:
            return .unknown(statusCode: statusCode)
        }
    }
}
