// AuthToken.swift
// Algo
//
// Token models for JWT-based authentication with refresh token rotation.

import Foundation

// MARK: - AuthToken

/// Response from POST /auth/login — contains access + refresh tokens and the authenticated user.
struct AuthToken: Codable, Sendable {

    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String
    let user: User

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
        case user
    }

    /// Computes the absolute expiration date from now based on `expiresIn` seconds.
    var expirationDate: Date {
        Date().addingTimeInterval(TimeInterval(expiresIn))
    }
}

// MARK: - RefreshResponse

/// Response from POST /auth/refresh — contains a new access token only.
struct RefreshResponse: Codable, Sendable {

    let accessToken: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case expiresIn = "expires_in"
    }
}
