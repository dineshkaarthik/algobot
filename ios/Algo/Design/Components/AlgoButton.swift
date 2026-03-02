// AlgoButton.swift
// Algo
//
// Reusable button component with multiple style variants.
// Supports loading state, disabled state, and full-width layout.

import SwiftUI

// MARK: - Button Style Enum

/// Visual styles available for `AlgoButton`.
enum AlgoButtonStyle {
    /// Filled primary-color background with white text.
    case primary
    /// Bordered outline with primary-color text.
    case secondary
    /// Filled red background for destructive actions.
    case destructive
    /// Transparent background with primary-color text (no border).
    case ghost
}

// MARK: - AlgoButton

/// A styled button component used throughout the Algo app.
///
/// Usage:
/// ```swift
/// AlgoButton("Send Message", style: .primary, isLoading: isSending) {
///     await sendMessage()
/// }
/// ```
struct AlgoButton: View {

    // MARK: Properties

    let title: String
    let style: AlgoButtonStyle
    let isLoading: Bool
    let isFullWidth: Bool
    let icon: String?
    let action: () -> Void

    // MARK: Initialization

    /// Creates a new `AlgoButton`.
    /// - Parameters:
    ///   - title: The button label text.
    ///   - style: Visual style variant. Defaults to `.primary`.
    ///   - isLoading: Whether to show a loading spinner. Defaults to `false`.
    ///   - isFullWidth: Whether the button should expand to full width. Defaults to `false`.
    ///   - icon: Optional SF Symbol name to show before the title.
    ///   - action: Closure executed on tap.
    init(
        _ title: String,
        style: AlgoButtonStyle = .primary,
        isLoading: Bool = false,
        isFullWidth: Bool = false,
        icon: String? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.style = style
        self.isLoading = isLoading
        self.isFullWidth = isFullWidth
        self.icon = icon
        self.action = action
    }

    // MARK: Body

    var body: some View {
        Button(action: {
            guard !isLoading else { return }
            action()
        }) {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: foregroundColor))
                        .scaleEffect(0.8)
                } else if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .medium))
                }

                Text(title)
                    .font(AlgoTypography.labelLarge)
            }
            .frame(maxWidth: isFullWidth ? .infinity : nil)
            .padding(.horizontal, AlgoTheme.Spacing.lg)
            .padding(.vertical, AlgoTheme.Spacing.sm)
            .foregroundStyle(foregroundColor)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
            .overlay {
                if style == .secondary {
                    RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm)
                        .strokeBorder(borderColor, lineWidth: 1.5)
                }
            }
        }
        .disabled(isLoading)
        .opacity(isLoading ? 0.8 : 1.0)
        .animation(AlgoTheme.Animation.fast, value: isLoading)
    }

    // MARK: Style Helpers

    private var foregroundColor: Color {
        switch style {
        case .primary:
            return AlgoTheme.Colors.textOnPrimary
        case .secondary:
            return AlgoTheme.Colors.primary
        case .destructive:
            return AlgoTheme.Colors.textOnPrimary
        case .ghost:
            return AlgoTheme.Colors.primary
        }
    }

    private var backgroundColor: Color {
        switch style {
        case .primary:
            return AlgoTheme.Colors.primary
        case .secondary:
            return Color.clear
        case .destructive:
            return AlgoTheme.Colors.error
        case .ghost:
            return Color.clear
        }
    }

    private var borderColor: Color {
        switch style {
        case .secondary:
            return AlgoTheme.Colors.primary.opacity(0.4)
        default:
            return Color.clear
        }
    }
}

// MARK: - Preview

#Preview("Button Styles") {
    VStack(spacing: 16) {
        AlgoButton("Primary Action", style: .primary) {}
        AlgoButton("Secondary Action", style: .secondary) {}
        AlgoButton("Delete Item", style: .destructive, icon: "trash") {}
        AlgoButton("Ghost Action", style: .ghost) {}
        AlgoButton("Loading...", style: .primary, isLoading: true) {}
        AlgoButton("Full Width", style: .primary, isFullWidth: true) {}
    }
    .padding()
}
