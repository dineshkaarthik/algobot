// BiometricAuthService.swift
// Algo
//
// Provides biometric authentication (Face ID / Touch ID) capabilities.
// Used as a convenience unlock mechanism after the user has signed in
// at least once with their credentials.

import LocalAuthentication

// MARK: - BiometricAuthService

final class BiometricAuthService {

    // MARK: - Biometric Type

    enum BiometricType {
        case faceID
        case touchID
        case none
    }

    // MARK: - Properties

    /// The biometric type available on the current device.
    var biometricType: BiometricType {
        let context = LAContext()
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        switch context.biometryType {
        case .faceID:
            return .faceID
        case .touchID:
            return .touchID
        default:
            return .none
        }
    }

    /// Whether any biometric authentication method is available.
    var isBiometricAvailable: Bool {
        biometricType != .none
    }

    // MARK: - Authentication

    /// Prompts the user for biometric authentication.
    ///
    /// - Returns: `true` if the user successfully authenticated; `false` otherwise.
    func authenticate() async -> Bool {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"

        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: "Unlock Algo to access your business data"
            )
        } catch {
            return false
        }
    }
}
