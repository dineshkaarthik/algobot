// DarkModeSupport.swift
// Algo
//
// Defines the app-level color scheme preference that allows users
// to override the system appearance. The selected scheme is persisted
// via @AppStorage and applied at the WindowGroup level.

import SwiftUI

// MARK: - AppColorScheme

/// Represents the user's preferred color scheme for the app.
///
/// - `system`: Follows the device's current appearance setting.
/// - `light`: Forces light mode regardless of system setting.
/// - `dark`: Forces dark mode regardless of system setting.
enum AppColorScheme: String, CaseIterable {
    case system
    case light
    case dark

    /// Returns the SwiftUI `ColorScheme` value, or `nil` for system default.
    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    /// Human-readable label for display in the settings UI.
    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}
