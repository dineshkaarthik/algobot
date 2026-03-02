// AuthViewModel.swift
// Algo
//
// Main authentication view model managing login state, biometric auth,
// and session lifecycle across the app.

import Foundation
import LocalAuthentication
import UIKit

// MARK: - AuthViewModel

@MainActor
final class AuthViewModel: ObservableObject {

    // MARK: - Published State

    @Published private(set) var isAuthenticated = false
    @Published private(set) var isLoading = false
    @Published private(set) var currentUser: User?
    @Published var error: AuthErrorState?

    /// Whether biometric authentication (Face ID / Touch ID) is available.
    @Published private(set) var isBiometricAvailable = false

    /// The type of biometric available on the device.
    @Published private(set) var biometricType: LABiometryType = .none

    /// Whether the app is currently locked behind biometric authentication.
    /// Set to `true` when the app returns to foreground and biometric is enabled.
    @Published var isBiometricLocked = false

    /// Whether the user has opted in to biometric unlock on app foreground.
    /// Persisted across launches via UserDefaults.
    @Published var biometricEnabled: Bool {
        didSet {
            UserDefaults.standard.set(biometricEnabled, forKey: UserDefaultsKey.biometricEnabled)
        }
    }

    // MARK: - Dependencies

    private let authService: AuthServiceProtocol
    private let biometricService = BiometricAuthService()

    // MARK: - Initialization

    init(authService: AuthServiceProtocol) {
        self.authService = authService
        self.biometricEnabled = UserDefaults.standard.bool(forKey: UserDefaultsKey.biometricEnabled)
        checkBiometricAvailability()
    }

    // MARK: - Login

    func login(email: String, password: String) async {
        guard !email.isEmpty, !password.isEmpty else {
            error = .init(message: "Please enter both email and password.")
            return
        }

        isLoading = true
        error = nil

        do {
            let user = try await authService.login(email: email, password: password)
            currentUser = user
            isAuthenticated = true

            // Remember that the user has logged in successfully for biometric unlock.
            UserDefaults.standard.set(true, forKey: UserDefaultsKey.hasLoggedInBefore)
        } catch {
            self.error = .init(message: mapErrorMessage(error))
        }

        isLoading = false
    }

    // MARK: - Register

    func register(email: String, password: String, name: String, tenantId: String) async {
        guard !email.isEmpty, !password.isEmpty, !name.isEmpty else {
            error = .init(message: "Please fill in all required fields.")
            return
        }

        isLoading = true
        error = nil

        do {
            let deviceId = UIDevice.current.identifierForVendor?.uuidString
                ?? AppConfiguration.deviceID
            let request = RegisterRequest(
                email: email,
                password: password,
                name: name,
                tenantId: tenantId,
                deviceId: deviceId
            )
            let user = try await authService.register(request: request)
            currentUser = user
            isAuthenticated = true

            UserDefaults.standard.set(true, forKey: UserDefaultsKey.hasLoggedInBefore)
        } catch {
            self.error = .init(message: mapErrorMessage(error))
        }

        isLoading = false
    }

    // MARK: - Logout

    func logout() async {
        isLoading = true

        await authService.logout()

        currentUser = nil
        isAuthenticated = false
        isLoading = false
    }

    // MARK: - Session Restoration

    /// Attempts to restore a previously authenticated session on app launch.
    /// If the stored access token is still valid, restores the user immediately.
    /// If expired, attempts a silent refresh. Falls back to logged-out state.
    func checkAuthOnLaunch() async {
        isLoading = true

        // Try loading the stored user and validating the token.
        guard let storedUser = authService.loadStoredUser() else {
            isLoading = false
            return
        }

        if authService.isTokenValid() {
            currentUser = storedUser
            isAuthenticated = true
            isLoading = false
            return
        }

        // Token expired -- attempt silent refresh.
        do {
            try await authService.refreshToken()
            currentUser = storedUser
            isAuthenticated = true
        } catch {
            // Refresh failed -- user must re-authenticate.
            currentUser = nil
            isAuthenticated = false
        }

        isLoading = false
    }

    // MARK: - Biometric Authentication

    func authenticateWithBiometric() async {
        let context = LAContext()
        var authError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &authError) else {
            error = .init(message: AuthError.biometricNotAvailable.localizedDescription)
            return
        }

        // Only offer biometric if the user has previously logged in successfully.
        guard UserDefaults.standard.bool(forKey: UserDefaultsKey.hasLoggedInBefore) else {
            error = .init(message: "Please log in with your credentials first.")
            return
        }

        isLoading = true
        error = nil

        do {
            let reason = "Unlock Algo to access your marketing assistant."
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )

            if success {
                // Biometric passed -- try to restore the session via token refresh.
                if let storedUser = authService.loadStoredUser() {
                    if authService.isTokenValid() {
                        currentUser = storedUser
                        isAuthenticated = true
                    } else {
                        try await authService.refreshToken()
                        currentUser = storedUser
                        isAuthenticated = true
                    }
                } else {
                    error = .init(message: "Session expired. Please log in with your credentials.")
                }
            }
        } catch {
            self.error = .init(message: AuthError.biometricFailed.localizedDescription)
        }

        isLoading = false
    }

    // MARK: - Biometric Lock / Unlock

    /// Called when the app returns to the foreground.
    /// If biometric unlock is enabled and the user is authenticated,
    /// locks the UI and prompts for Face ID / Touch ID.
    func checkBiometric() async {
        guard biometricEnabled,
              isAuthenticated,
              biometricService.isBiometricAvailable else {
            return
        }

        isBiometricLocked = true

        let success = await biometricService.authenticate()
        if success {
            isBiometricLocked = false
        }
        // If authentication fails, the lock screen remains visible
        // so the user can retry or fall back to credentials.
    }

    // MARK: - Biometric Availability

    private func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?

        isBiometricAvailable = context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )
        biometricType = context.biometryType
    }

    // MARK: - Error Mapping

    private func mapErrorMessage(_ error: Error) -> String {
        if let authError = error as? AuthError {
            return authError.localizedDescription
        }
        if let apiError = error as? APIError {
            return apiError.localizedDescription
        }
        return "An unexpected error occurred. Please try again."
    }
}

// MARK: - AuthErrorState

/// Identifiable error wrapper for SwiftUI alert/sheet presentation.
struct AuthErrorState: Identifiable, Equatable {
    let id = UUID()
    let message: String

    static func == (lhs: AuthErrorState, rhs: AuthErrorState) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - UserDefaults Keys

private enum UserDefaultsKey {
    static let hasLoggedInBefore = "com.algonit.algo.hasLoggedInBefore"
    static let biometricEnabled = "com.algonit.algo.biometricEnabled"
}
