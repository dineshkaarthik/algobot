// KeychainManager.swift
// Algo
//
// Provides secure storage for authentication tokens and sensitive data
// using the iOS Keychain Services API.
//
// All items are stored with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
// to prevent access from backups or other devices.

import Foundation
import Security

/// Manages secure storage of tokens and credentials in the iOS Keychain.
///
/// Usage:
/// ```swift
/// let keychain = KeychainManager()
/// try keychain.saveToken("eyJhbGci...")
/// let token = keychain.getToken()
/// ```
final class KeychainManager: Sendable {

    // MARK: - Constants

    /// Keys for storing auth-related data in the Keychain.
    enum Key {
        static let accessToken = "com.algonit.algo.accessToken"
        static let refreshToken = "com.algonit.algo.refreshToken"
        static let tenantID = "com.algonit.algo.tenantID"
        static let userID = "com.algonit.algo.userID"
    }

    /// The service name used to scope Keychain queries.
    private let service: String

    // MARK: - Initialization

    /// Creates a new `KeychainManager` with the specified service identifier.
    ///
    /// - Parameter service: The Keychain service name. Defaults to the app's bundle identifier.
    init(service: String = Bundle.main.bundleIdentifier ?? "com.algonit.algo") {
        self.service = service
    }

    // MARK: - Core Operations

    /// Saves raw data to the Keychain under the specified key.
    ///
    /// If an entry with the same key already exists, it is deleted first
    /// to avoid `errSecDuplicateItem` errors.
    ///
    /// - Parameters:
    ///   - key: The unique key to store the data under.
    ///   - data: The raw bytes to store.
    /// - Throws: `KeychainError.saveFailed` if the operation fails.
    func save(key: String, data: Data) throws {
        // Remove any existing item first to avoid duplicates
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    /// Loads raw data from the Keychain for the specified key.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The stored data, or `nil` if no entry exists.
    func load(key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            return nil
        }
        return result as? Data
    }

    /// Deletes the Keychain entry for the specified key.
    ///
    /// - Parameter key: The key to delete. No error is raised if the key doesn't exist.
    func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Token Convenience Methods

    /// Saves a JWT access token string to the Keychain.
    ///
    /// - Parameter token: The access token string.
    /// - Throws: `KeychainError.saveFailed` if storage fails.
    func saveToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }
        try save(key: Key.accessToken, data: data)
    }

    /// Retrieves the stored JWT access token.
    ///
    /// - Returns: The access token string, or `nil` if not stored.
    func getToken() -> String? {
        guard let data = load(key: Key.accessToken) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Saves a refresh token string to the Keychain.
    ///
    /// - Parameter token: The refresh token string.
    /// - Throws: `KeychainError.saveFailed` if storage fails.
    func saveRefreshToken(_ token: String) throws {
        guard let data = token.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }
        try save(key: Key.refreshToken, data: data)
    }

    /// Retrieves the stored refresh token.
    ///
    /// - Returns: The refresh token string, or `nil` if not stored.
    func getRefreshToken() -> String? {
        guard let data = load(key: Key.refreshToken) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Saves the tenant ID for the current authenticated user.
    ///
    /// - Parameter tenantID: The tenant identifier string.
    /// - Throws: `KeychainError.saveFailed` if storage fails.
    func saveTenantID(_ tenantID: String) throws {
        guard let data = tenantID.data(using: .utf8) else {
            throw KeychainError.encodingFailed
        }
        try save(key: Key.tenantID, data: data)
    }

    /// Retrieves the stored tenant ID.
    ///
    /// - Returns: The tenant ID string, or `nil` if not stored.
    func getTenantID() -> String? {
        guard let data = load(key: Key.tenantID) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Removes all Algo-related entries from the Keychain.
    ///
    /// Call this during logout to ensure no credentials persist.
    func clearAll() {
        delete(key: Key.accessToken)
        delete(key: Key.refreshToken)
        delete(key: Key.tenantID)
        delete(key: Key.userID)
    }

    /// Whether a valid access token is currently stored.
    var hasToken: Bool {
        getToken() != nil
    }
}

// MARK: - KeychainError

/// Errors that can occur during Keychain operations.
enum KeychainError: LocalizedError {
    /// The Keychain `SecItemAdd` call failed with the given `OSStatus`.
    case saveFailed(OSStatus)

    /// The string could not be encoded to UTF-8 data.
    case encodingFailed

    var errorDescription: String? {
        switch self {
        case .saveFailed(let status):
            return "Keychain save failed with status: \(status)"
        case .encodingFailed:
            return "Failed to encode data for Keychain storage"
        }
    }
}
