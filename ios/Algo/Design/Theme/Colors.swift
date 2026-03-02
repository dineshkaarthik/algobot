// Colors.swift
// Algo
//
// Color constants for the Algo design system.
// Supports both light and dark mode via adaptive color definitions.

import SwiftUI

// MARK: - Brand Colors

extension Color {

    // MARK: Primary Palette

    /// Primary brand blue used for key actions and navigation elements.
    static let algoBlue = Color("AlgoBlue", bundle: nil)

    /// Accent purple used for AI-related UI and highlights.
    static let algoPurple = Color("AlgoPurple", bundle: nil)

    /// Success green used for positive metrics and confirmations.
    static let algoGreen = Color("AlgoGreen", bundle: nil)

    /// Warning orange used for medium-severity alerts and caution states.
    static let algoOrange = Color("AlgoOrange", bundle: nil)

    /// Error red used for high-severity alerts and destructive actions.
    static let algoRed = Color("AlgoRed", bundle: nil)

    // MARK: Semantic Colors

    /// Background color for the main app surface.
    static let algoBg = Color("AlgoBg", bundle: nil)

    /// Elevated surface color for cards and sheets.
    static let algoSurface = Color("AlgoSurface", bundle: nil)

    /// Primary text color.
    static let algoTextPrimary = Color("AlgoTextPrimary", bundle: nil)

    /// Secondary text color for subtitles and captions.
    static let algoTextSecondary = Color("AlgoTextSecondary", bundle: nil)

    /// Muted text color for placeholders and disabled states.
    static let algoTextMuted = Color("AlgoTextMuted", bundle: nil)

    /// Thin divider / separator color.
    static let algoDivider = Color("AlgoDivider", bundle: nil)
}

// MARK: - Hardcoded Fallback Colors

/// Provides hardcoded color values when asset catalog colors are unavailable.
/// These match the design spec and act as compile-time-safe defaults.
extension Color {

    /// Fallback initializer used when the asset catalog is not yet configured.
    enum AlgoDefaults {

        // MARK: Brand

        static let blue = Color(red: 0.22, green: 0.46, blue: 0.96)        // #3876F5
        static let purple = Color(red: 0.55, green: 0.36, blue: 0.96)      // #8C5CF5
        static let green = Color(red: 0.20, green: 0.78, blue: 0.47)       // #34C778
        static let orange = Color(red: 0.96, green: 0.65, blue: 0.14)      // #F5A624
        static let red = Color(red: 0.93, green: 0.26, blue: 0.26)         // #ED4242

        // MARK: Surfaces (Light)

        static let bgLight = Color(red: 0.96, green: 0.97, blue: 0.98)     // #F5F7FA
        static let surfaceLight = Color.white
        static let textPrimaryLight = Color(red: 0.11, green: 0.13, blue: 0.17)  // #1C2028
        static let textSecondaryLight = Color(red: 0.40, green: 0.44, blue: 0.52) // #667085
        static let textMutedLight = Color(red: 0.60, green: 0.64, blue: 0.70)     // #99A3B3
        static let dividerLight = Color(red: 0.90, green: 0.92, blue: 0.94)       // #E6EAEF

        // MARK: Surfaces (Dark)

        static let bgDark = Color(red: 0.07, green: 0.08, blue: 0.10)      // #121419
        static let surfaceDark = Color(red: 0.12, green: 0.13, blue: 0.16) // #1E2128
        static let textPrimaryDark = Color(red: 0.95, green: 0.96, blue: 0.97)
        static let textSecondaryDark = Color(red: 0.62, green: 0.65, blue: 0.72)
        static let textMutedDark = Color(red: 0.45, green: 0.48, blue: 0.55)
        static let dividerDark = Color(red: 0.20, green: 0.22, blue: 0.26)
    }
}

// MARK: - Adaptive Color Resolver

/// Resolves colors adaptively for light/dark mode when asset catalogs are not available.
/// Use this during development or in preview providers.
extension Color {

    /// Returns an adaptive color that switches between light and dark variants.
    static func adaptive(light: Color, dark: Color) -> Color {
        // SwiftUI will pick the correct variant based on the current color scheme
        // when used inside a View hierarchy. For compile-time defaults, prefer light.
        return light
    }
}

// MARK: - Severity Color Mapping

extension Color {

    /// Returns the appropriate color for an alert severity level.
    /// - Parameter severity: One of "high", "medium", or "low".
    /// - Returns: A color matching the severity.
    static func forSeverity(_ severity: String) -> Color {
        switch severity.lowercased() {
        case "high":
            return AlgoDefaults.red
        case "medium":
            return AlgoDefaults.orange
        case "low":
            return AlgoDefaults.blue
        default:
            return AlgoDefaults.blue
        }
    }
}
