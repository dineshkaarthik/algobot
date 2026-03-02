// AlgoTheme.swift
// Algo
//
// Central theme configuration for the Algo design system.
// Provides a unified interface for colors, typography, spacing,
// corner radii, and shadows used across the entire app.

import SwiftUI

// MARK: - AlgoTheme

/// Provides the complete design token set for the Algo app.
/// Access via `AlgoTheme.colors`, `AlgoTheme.spacing`, etc.
enum AlgoTheme {

    // MARK: - Colors

    /// Color tokens resolved for the current color scheme.
    enum Colors {

        // MARK: Brand

        static let primary = Color.AlgoDefaults.blue
        static let secondary = Color.AlgoDefaults.purple
        static let accent = Color.AlgoDefaults.blue

        // MARK: Semantic

        static let success = Color.AlgoDefaults.green
        static let warning = Color.AlgoDefaults.orange
        static let error = Color.AlgoDefaults.red
        static let info = Color.AlgoDefaults.blue

        // MARK: Surfaces

        static let background = Color(.systemBackground)
        static let secondaryBackground = Color(.secondarySystemBackground)
        static let tertiaryBackground = Color(.tertiarySystemBackground)
        static let surface = Color(.systemBackground)
        static let elevatedSurface = Color(.secondarySystemBackground)
        static let groupedBackground = Color(.systemGroupedBackground)

        // MARK: Text

        static let textPrimary = Color(.label)
        static let textSecondary = Color(.secondaryLabel)
        static let textTertiary = Color(.tertiaryLabel)
        static let textOnPrimary = Color.white

        // MARK: Borders & Dividers

        static let divider = Color(.separator)
        static let border = Color(.opaqueSeparator)

        // MARK: Interactive

        static let tint = primary
        static let disabled = Color(.systemGray4)
        static let disabledText = Color(.systemGray2)
    }

    // MARK: - Spacing

    /// Standard spacing values for consistent layout.
    enum Spacing {
        /// 2pt - Hairline spacing.
        static let xxxs: CGFloat = 2
        /// 4pt - Minimal spacing.
        static let xxs: CGFloat = 4
        /// 8pt - Tight spacing.
        static let xs: CGFloat = 8
        /// 12pt - Compact spacing.
        static let sm: CGFloat = 12
        /// 16pt - Standard spacing.
        static let md: CGFloat = 16
        /// 20pt - Comfortable spacing.
        static let lg: CGFloat = 20
        /// 24pt - Relaxed spacing.
        static let xl: CGFloat = 24
        /// 32pt - Generous spacing.
        static let xxl: CGFloat = 32
        /// 48pt - Section-level spacing.
        static let xxxl: CGFloat = 48
    }

    // MARK: - Corner Radius

    /// Corner radius tokens for consistent rounding.
    enum CornerRadius {
        /// 4pt - Subtle rounding.
        static let xs: CGFloat = 4
        /// 8pt - Standard rounding.
        static let sm: CGFloat = 8
        /// 12pt - Card rounding.
        static let md: CGFloat = 12
        /// 16pt - Prominent rounding.
        static let lg: CGFloat = 16
        /// 24pt - Pill shape.
        static let xl: CGFloat = 24
        /// Full circle.
        static let full: CGFloat = .infinity
    }

    // MARK: - Shadow

    /// Shadow styles for elevation hierarchy.
    enum Shadow {

        /// Subtle shadow for cards and tiles.
        static let sm = ShadowStyle(
            color: Color.black.opacity(0.06),
            radius: 4,
            x: 0,
            y: 2
        )

        /// Medium shadow for elevated surfaces.
        static let md = ShadowStyle(
            color: Color.black.opacity(0.10),
            radius: 8,
            x: 0,
            y: 4
        )

        /// Large shadow for modals and popovers.
        static let lg = ShadowStyle(
            color: Color.black.opacity(0.15),
            radius: 16,
            x: 0,
            y: 8
        )
    }

    // MARK: - Animation

    /// Standard animation durations and curves.
    enum Animation {
        static let fast: SwiftUI.Animation = .easeInOut(duration: 0.15)
        static let standard: SwiftUI.Animation = .easeInOut(duration: 0.25)
        static let slow: SwiftUI.Animation = .easeInOut(duration: 0.4)
        static let spring: SwiftUI.Animation = .spring(response: 0.35, dampingFraction: 0.7)
    }

    // MARK: - Icon Size

    /// Standard icon sizes.
    enum IconSize {
        static let sm: CGFloat = 16
        static let md: CGFloat = 20
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }
}

// MARK: - ShadowStyle

/// Represents a reusable shadow configuration.
struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

// MARK: - Shadow View Modifier

extension View {

    /// Applies a predefined `ShadowStyle` to the view.
    func algoShadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}

// MARK: - Card Style Modifier

/// Applies standard card styling with background, corner radius, and shadow.
struct AlgoCardModifier: ViewModifier {

    var cornerRadius: CGFloat = AlgoTheme.CornerRadius.md
    var shadow: ShadowStyle = AlgoTheme.Shadow.sm

    func body(content: Content) -> some View {
        content
            .background(AlgoTheme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .algoShadow(shadow)
    }
}

extension View {

    /// Applies the standard Algo card style.
    func algoCard(
        cornerRadius: CGFloat = AlgoTheme.CornerRadius.md,
        shadow: ShadowStyle = AlgoTheme.Shadow.sm
    ) -> some View {
        modifier(AlgoCardModifier(cornerRadius: cornerRadius, shadow: shadow))
    }
}
