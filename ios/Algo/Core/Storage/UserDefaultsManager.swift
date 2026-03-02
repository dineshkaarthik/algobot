// UserDefaultsManager.swift
// Algo
//
// Manages non-sensitive app preferences using UserDefaults.
// Provides typed access to settings like notification preferences,
// theme selection, onboarding state, and sync timestamps.

import Foundation
import SwiftUI

// MARK: - UserDefaults Keys

/// Centralized keys for all UserDefaults entries used by the Algo app.
enum UserDefaultsKey {
    static let notificationsEnabled = "algo_notifications_enabled"
    static let notificationSoundEnabled = "algo_notification_sound_enabled"
    static let themePreference = "algo_theme_preference"
    static let lastSyncDate = "algo_last_sync_date"
    static let onboardingCompleted = "algo_onboarding_completed"
    static let voiceInputEnabled = "algo_voice_input_enabled"
    static let autoPlayTTS = "algo_auto_play_tts"
    static let hapticFeedbackEnabled = "algo_haptic_feedback_enabled"
    static let lastViewedConversationId = "algo_last_viewed_conversation_id"
    static let preferredLanguage = "algo_preferred_language"
    static let biometricAuthEnabled = "algo_biometric_auth_enabled"
}

// MARK: - Theme Preference

/// The user's preferred color scheme.
enum ThemePreference: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    /// Converts to a SwiftUI `ColorScheme` for manual overrides.
    /// Returns `nil` for `.system` to let the OS decide.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

// MARK: - UserDefaultsManager

/// Provides typed access to all app preferences stored in UserDefaults.
///
/// Usage:
/// ```swift
/// let manager = UserDefaultsManager()
/// manager.onboardingCompleted = true
/// let theme = manager.themePreference
/// ```
///
/// For SwiftUI `@AppStorage` bindings in views, use the key constants from
/// `UserDefaultsKey` directly:
/// ```swift
/// @AppStorage(UserDefaultsKey.themePreference) var theme = ThemePreference.system.rawValue
/// ```
final class UserDefaultsManager: Sendable {

    // MARK: - Properties

    private let defaults: UserDefaults

    // MARK: - Initialization

    /// Creates a new `UserDefaultsManager`.
    ///
    /// - Parameter defaults: The `UserDefaults` suite to use. Defaults to `.standard`.
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        registerDefaults()
    }

    /// Registers default values for all keys.
    private func registerDefaults() {
        defaults.register(defaults: [
            UserDefaultsKey.notificationsEnabled: true,
            UserDefaultsKey.notificationSoundEnabled: true,
            UserDefaultsKey.themePreference: ThemePreference.system.rawValue,
            UserDefaultsKey.onboardingCompleted: false,
            UserDefaultsKey.voiceInputEnabled: true,
            UserDefaultsKey.autoPlayTTS: false,
            UserDefaultsKey.hapticFeedbackEnabled: true,
            UserDefaultsKey.biometricAuthEnabled: false,
            UserDefaultsKey.preferredLanguage: "en"
        ])
    }

    // MARK: - Notification Settings

    /// Whether push notifications are enabled in-app.
    var notificationsEnabled: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.notificationsEnabled) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.notificationsEnabled) }
    }

    /// Whether notification sounds are enabled.
    var notificationSoundEnabled: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.notificationSoundEnabled) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.notificationSoundEnabled) }
    }

    // MARK: - Theme

    /// The user's preferred theme (system, light, or dark).
    var themePreference: ThemePreference {
        get {
            let rawValue = defaults.string(forKey: UserDefaultsKey.themePreference) ?? ThemePreference.system.rawValue
            return ThemePreference(rawValue: rawValue) ?? .system
        }
        set {
            defaults.set(newValue.rawValue, forKey: UserDefaultsKey.themePreference)
        }
    }

    // MARK: - Sync

    /// The date of the last successful data sync with the backend.
    var lastSyncDate: Date? {
        get { defaults.object(forKey: UserDefaultsKey.lastSyncDate) as? Date }
        set { defaults.set(newValue, forKey: UserDefaultsKey.lastSyncDate) }
    }

    // MARK: - Onboarding

    /// Whether the user has completed the onboarding flow.
    var onboardingCompleted: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.onboardingCompleted) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.onboardingCompleted) }
    }

    // MARK: - Voice & Audio

    /// Whether voice input is enabled.
    var voiceInputEnabled: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.voiceInputEnabled) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.voiceInputEnabled) }
    }

    /// Whether TTS responses should auto-play.
    var autoPlayTTS: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.autoPlayTTS) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.autoPlayTTS) }
    }

    // MARK: - Interaction

    /// Whether haptic feedback is enabled for UI interactions.
    var hapticFeedbackEnabled: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.hapticFeedbackEnabled) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.hapticFeedbackEnabled) }
    }

    // MARK: - Security

    /// Whether biometric authentication (Face ID / Touch ID) is enabled.
    var biometricAuthEnabled: Bool {
        get { defaults.bool(forKey: UserDefaultsKey.biometricAuthEnabled) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.biometricAuthEnabled) }
    }

    // MARK: - Conversation State

    /// The ID of the last viewed conversation for restoring state.
    var lastViewedConversationId: String? {
        get { defaults.string(forKey: UserDefaultsKey.lastViewedConversationId) }
        set { defaults.set(newValue, forKey: UserDefaultsKey.lastViewedConversationId) }
    }

    // MARK: - Language

    /// The user's preferred language code (e.g., "en", "es").
    var preferredLanguage: String {
        get { defaults.string(forKey: UserDefaultsKey.preferredLanguage) ?? "en" }
        set { defaults.set(newValue, forKey: UserDefaultsKey.preferredLanguage) }
    }

    // MARK: - Reset

    /// Resets all Algo-specific preferences to their default values.
    ///
    /// Typically called during logout to clear user-specific settings.
    func resetAll() {
        let keys = [
            UserDefaultsKey.notificationsEnabled,
            UserDefaultsKey.notificationSoundEnabled,
            UserDefaultsKey.themePreference,
            UserDefaultsKey.lastSyncDate,
            UserDefaultsKey.onboardingCompleted,
            UserDefaultsKey.voiceInputEnabled,
            UserDefaultsKey.autoPlayTTS,
            UserDefaultsKey.hapticFeedbackEnabled,
            UserDefaultsKey.lastViewedConversationId,
            UserDefaultsKey.preferredLanguage,
            UserDefaultsKey.biometricAuthEnabled
        ]
        for key in keys {
            defaults.removeObject(forKey: key)
        }
        registerDefaults()
    }
}
