// ErrorView.swift
// Algo
//
// Error display component with compact and full-screen variants.
// Shows an error icon, descriptive message, and optional retry button.

import SwiftUI

// MARK: - ErrorView

/// Displays an error state with an icon, message, and optional retry action.
///
/// Usage:
/// ```swift
/// // Compact inline error
/// ErrorView(message: "Failed to load data", retryAction: { reload() })
///
/// // Full-screen error
/// ErrorView(
///     message: "Something went wrong",
///     detail: "Please check your connection and try again.",
///     isFullScreen: true,
///     retryAction: { reload() }
/// )
/// ```
struct ErrorView: View {

    // MARK: Properties

    /// Primary error message.
    let message: String

    /// Optional secondary detail text providing more context.
    let detail: String?

    /// When `true`, renders centered in a full-screen layout.
    let isFullScreen: Bool

    /// Optional retry action. When provided, a retry button is shown.
    let retryAction: (() -> Void)?

    // MARK: Initialization

    /// Creates a new `ErrorView`.
    /// - Parameters:
    ///   - message: The primary error message to display.
    ///   - detail: Optional secondary message with more details.
    ///   - isFullScreen: Whether to center the error in a full-screen layout. Defaults to `false`.
    ///   - retryAction: Optional closure executed when the retry button is tapped.
    init(
        message: String,
        detail: String? = nil,
        isFullScreen: Bool = false,
        retryAction: (() -> Void)? = nil
    ) {
        self.message = message
        self.detail = detail
        self.isFullScreen = isFullScreen
        self.retryAction = retryAction
    }

    /// Convenience initializer matching the old API.
    init(_ message: String, retryAction: (() -> Void)? = nil) {
        self.message = message
        self.detail = nil
        self.isFullScreen = true
        self.retryAction = retryAction
    }

    // MARK: Body

    var body: some View {
        if isFullScreen {
            fullScreenContent
        } else {
            compactContent
        }
    }

    // MARK: Compact Layout

    private var compactContent: some View {
        HStack(spacing: AlgoTheme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 20))
                .foregroundStyle(AlgoTheme.Colors.error)

            VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxxs) {
                Text(message)
                    .font(AlgoTypography.bodySmall)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)

                if let detail {
                    Text(detail)
                        .font(AlgoTypography.caption)
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
            }

            Spacer()

            if let retryAction {
                Button(action: retryAction) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(AlgoTheme.Colors.primary)
                }
            }
        }
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.error.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
    }

    // MARK: Full-Screen Layout

    private var fullScreenContent: some View {
        ContentUnavailableView {
            Label("Error", systemImage: "exclamationmark.triangle")
        } description: {
            VStack(spacing: AlgoTheme.Spacing.xs) {
                Text(message)

                if let detail {
                    Text(detail)
                        .font(AlgoTypography.bodySmall)
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
            }
        } actions: {
            if let retryAction {
                Button("Try Again", action: retryAction)
                    .buttonStyle(.bordered)
            }
        }
    }
}

// MARK: - Preview

#Preview("Error Views") {
    VStack(spacing: 30) {
        ErrorView(
            message: "Failed to load metrics",
            retryAction: {}
        )

        Divider()

        ErrorView(
            message: "Something went wrong",
            detail: "Please check your internet connection and try again.",
            isFullScreen: true,
            retryAction: {}
        )
    }
    .padding()
}
