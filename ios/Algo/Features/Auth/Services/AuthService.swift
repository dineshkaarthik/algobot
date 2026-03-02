// AuthService.swift
// Algo
//
// Authentication service handling login, registration, token management,
// and secure credential storage via Keychain.

import Foundation
import UIKit

// MARK: - AuthServiceProtocol

protocol AuthServiceProtocol: Sendable {
    func login(email: String, password: String) async throws -> User
    func register(request: RegisterRequest) async throws -> User
    func logout() async
    func refreshToken() async throws
    func loadStoredUser() -> User?
    func isTokenValid() -> Bool
}

// MARK: - AuthService

final class AuthService: AuthServiceProtocol, @unchecked Sendable {

    // MARK: - Constants

    private enum StorageKey {
        static let tokenExpiration = "com.algonit.algo.tokenExpiration"
        static let currentUser = "com.algonit.algo.currentUser"
    }

    // MARK: - Dependencies

    private let apiClient: APIClient
    private let keychain: KeychainManager

    /// Buffer (in seconds) before actual expiration to proactively refresh the token.
    private let tokenRefreshBuffer: TimeInterval = 300 // 5 minutes

    // MARK: - Initialization

    init(apiClient: APIClient, keychain: KeychainManager = KeychainManager()) {
        self.apiClient = apiClient
        self.keychain = keychain
    }

    // MARK: - Device Identification

    /// Returns a stable device identifier, preferring `identifierForVendor` and
    /// falling back to the persisted `AppConfiguration.deviceID`.
    private var deviceId: String {
        UIDevice.current.identifierForVendor?.uuidString ?? AppConfiguration.deviceID
    }

    // MARK: - Login

    func login(email: String, password: String) async throws -> User {
        let body = LoginRequest(email: email, password: password, deviceId: deviceId)

        let authToken: AuthToken = try await apiClient.post(.login, body: body)

        try storeTokens(authToken)
        try storeUser(authToken.user)

        return authToken.user
    }

    // MARK: - Register

    func register(request: RegisterRequest) async throws -> User {
        let authToken: AuthToken = try await apiClient.post(.register, body: request)

        try storeTokens(authToken)
        try storeUser(authToken.user)

        return authToken.user
    }

    // MARK: - Logout

    func logout() async {
        // Best-effort server-side logout; do not block on failure.
        let body = LogoutRequest(deviceId: deviceId)
        try? await apiClient.post(.logout, body: body)

        clearStoredCredentials()
    }

    // MARK: - Token Refresh

    func refreshToken() async throws {
        guard let storedRefreshToken = keychain.getRefreshToken() else {
            throw AuthError.noRefreshToken
        }

        let body = RefreshTokenRequest(refreshToken: storedRefreshToken)

        let response: RefreshResponse = try await apiClient.post(.refresh, body: body)

        try storeAccessToken(response.accessToken, expiresIn: response.expiresIn)
    }

    // MARK: - Token Validation

    func isTokenValid() -> Bool {
        guard keychain.hasToken,
              let expirationData = keychain.load(key: StorageKey.tokenExpiration),
              let expirationString = String(data: expirationData, encoding: .utf8),
              let expirationInterval = TimeInterval(expirationString) else {
            return false
        }

        let expirationDate = Date(timeIntervalSince1970: expirationInterval)
        return expirationDate > Date().addingTimeInterval(tokenRefreshBuffer)
    }

    // MARK: - Stored User

    func loadStoredUser() -> User? {
        guard let userData = keychain.load(key: StorageKey.currentUser) else {
            return nil
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try? decoder.decode(User.self, from: userData)
    }

    // MARK: - Private Helpers

    private func storeTokens(_ authToken: AuthToken) throws {
        try keychain.saveToken(authToken.accessToken)
        try keychain.saveRefreshToken(authToken.refreshToken)
        try keychain.saveTenantID(authToken.user.tenantId)
        try storeAccessToken(authToken.accessToken, expiresIn: authToken.expiresIn)
    }

    private func storeAccessToken(_ token: String, expiresIn: Int) throws {
        try keychain.saveToken(token)

        let expirationDate = Date().addingTimeInterval(TimeInterval(expiresIn))
        let expirationString = String(expirationDate.timeIntervalSince1970)
        if let expirationData = expirationString.data(using: .utf8) {
            try keychain.save(key: StorageKey.tokenExpiration, data: expirationData)
        }
    }

    private func storeUser(_ user: User) throws {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let userData = try encoder.encode(user)
        try keychain.save(key: StorageKey.currentUser, data: userData)
    }

    private func clearStoredCredentials() {
        keychain.clearAll()
        keychain.delete(key: StorageKey.tokenExpiration)
        keychain.delete(key: StorageKey.currentUser)
    }
}

// MARK: - Supporting Types

/// Request body for POST /auth/refresh.
private struct RefreshTokenRequest: Codable, Sendable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

// MARK: - AuthError

enum AuthError: LocalizedError, Sendable {
    case noRefreshToken
    case tokenExpired
    case invalidCredentials
    case registrationFailed(String)
    case biometricNotAvailable
    case biometricFailed
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .noRefreshToken:
            "No refresh token available. Please log in again."
        case .tokenExpired:
            "Your session has expired. Please log in again."
        case .invalidCredentials:
            "Invalid email or password. Please try again."
        case .registrationFailed(let reason):
            "Registration failed: \(reason)"
        case .biometricNotAvailable:
            "Biometric authentication is not available on this device."
        case .biometricFailed:
            "Biometric authentication failed. Please try again or use your password."
        case .unknown(let message):
            message
        }
    }
}
