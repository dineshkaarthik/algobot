// Typography.swift
// Algo
//
// Text style definitions for the Algo design system.
// Uses the system SF Pro font with defined weights and sizes
// to ensure consistency across the app.

import SwiftUI

// MARK: - AlgoTypography

/// Centralized text style definitions used throughout the app.
/// All styles use the system font (SF Pro) for optimal readability on iOS.
enum AlgoTypography {

    // MARK: Display

    /// Large display text for hero sections. 34pt bold.
    static let displayLarge = Font.system(size: 34, weight: .bold, design: .default)

    /// Medium display text. 28pt bold.
    static let displayMedium = Font.system(size: 28, weight: .bold, design: .default)

    // MARK: Title

    /// Primary title. 22pt semibold.
    static let titleLarge = Font.system(size: 22, weight: .semibold, design: .default)

    /// Secondary title. 20pt semibold.
    static let titleMedium = Font.system(size: 20, weight: .semibold, design: .default)

    /// Tertiary title. 17pt semibold.
    static let titleSmall = Font.system(size: 17, weight: .semibold, design: .default)

    // MARK: Headline

    /// Headline for section headers. 17pt semibold.
    static let headline = Font.system(size: 17, weight: .semibold, design: .default)

    /// Subheadline for supporting text. 15pt regular.
    static let subheadline = Font.system(size: 15, weight: .regular, design: .default)

    // MARK: Body

    /// Primary body text. 17pt regular.
    static let bodyLarge = Font.system(size: 17, weight: .regular, design: .default)

    /// Standard body text. 15pt regular.
    static let bodyMedium = Font.system(size: 15, weight: .regular, design: .default)

    /// Compact body text. 13pt regular.
    static let bodySmall = Font.system(size: 13, weight: .regular, design: .default)

    // MARK: Label

    /// Button and label text. 15pt medium.
    static let labelLarge = Font.system(size: 15, weight: .medium, design: .default)

    /// Secondary label text. 13pt medium.
    static let labelMedium = Font.system(size: 13, weight: .medium, design: .default)

    /// Small label text. 11pt medium.
    static let labelSmall = Font.system(size: 11, weight: .medium, design: .default)

    // MARK: Caption

    /// Caption text for timestamps and metadata. 12pt regular.
    static let caption = Font.system(size: 12, weight: .regular, design: .default)

    /// Bold caption. 12pt medium.
    static let captionBold = Font.system(size: 12, weight: .medium, design: .default)

    // MARK: Metric

    /// Large metric value display. 28pt bold, rounded design for numbers.
    static let metricLarge = Font.system(size: 28, weight: .bold, design: .rounded)

    /// Medium metric value. 22pt bold, rounded.
    static let metricMedium = Font.system(size: 22, weight: .bold, design: .rounded)

    /// Small metric value. 17pt semibold, rounded.
    static let metricSmall = Font.system(size: 17, weight: .semibold, design: .rounded)

    // MARK: Monospaced

    /// Monospaced text for data and codes. 14pt regular monospaced.
    static let mono = Font.system(size: 14, weight: .regular, design: .monospaced)
}

// MARK: - View Modifier for Text Styles

/// Convenience view modifier that applies a predefined Algo text style.
struct AlgoTextStyle: ViewModifier {

    let font: Font
    let color: Color

    func body(content: Content) -> some View {
        content
            .font(font)
            .foregroundStyle(color)
    }
}

extension View {

    /// Applies a predefined Algo text style with an optional custom color.
    func algoTextStyle(
        _ font: Font,
        color: Color = Color.AlgoDefaults.textPrimaryLight
    ) -> some View {
        modifier(AlgoTextStyle(font: font, color: color))
    }
}
