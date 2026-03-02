// LoadingView.swift
// Algo
//
// Loading indicator component with support for inline and full-screen overlay modes.
// Shows an animated spinner with an optional descriptive message.

import SwiftUI

// MARK: - LoadingView

/// Displays a centered loading spinner with an optional message.
///
/// Usage:
/// ```swift
/// // Inline usage
/// LoadingView(message: "Loading dashboard...")
///
/// // Full-screen overlay
/// LoadingView(message: "Please wait...", isOverlay: true)
/// ```
struct LoadingView: View {

    // MARK: Properties

    /// Optional text shown below the spinner.
    let message: String?

    /// When `true`, renders as a full-screen semi-transparent overlay.
    let isOverlay: Bool

    // MARK: Initialization

    /// Creates a new `LoadingView`.
    /// - Parameters:
    ///   - message: Descriptive text shown below the spinner. Defaults to `"Loading..."`.
    ///   - isOverlay: Whether to render as a full-screen overlay. Defaults to `false`.
    init(message: String? = "Loading...", isOverlay: Bool = false) {
        self.message = message
        self.isOverlay = isOverlay
    }

    /// Convenience initializer matching the old API.
    init(_ message: String? = nil) {
        self.message = message
        self.isOverlay = false
    }

    // MARK: Body

    var body: some View {
        if isOverlay {
            overlayContent
        } else {
            inlineContent
        }
    }

    // MARK: Inline Content

    private var inlineContent: some View {
        VStack(spacing: AlgoTheme.Spacing.sm) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: AlgoTheme.Colors.primary))
                .controlSize(.regular)

            if let message {
                Text(message)
                    .font(AlgoTypography.bodySmall)
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message ?? "Loading")
    }

    // MARK: Overlay Content

    private var overlayContent: some View {
        ZStack {
            Color.black.opacity(0.3)
                .ignoresSafeArea()

            VStack(spacing: AlgoTheme.Spacing.md) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: AlgoTheme.Colors.primary))
                    .scaleEffect(1.4)

                if let message {
                    Text(message)
                        .font(AlgoTypography.bodyMedium)
                        .foregroundStyle(AlgoTheme.Colors.textPrimary)
                }
            }
            .padding(AlgoTheme.Spacing.xl)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.lg))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message ?? "Loading")
    }
}

// MARK: - Shimmer Modifier

/// Applies a shimmer loading animation to placeholder content.
/// Useful for skeleton screens while data is being fetched.
struct ShimmerModifier: ViewModifier {

    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay {
                LinearGradient(
                    colors: [
                        Color.clear,
                        Color.white.opacity(0.4),
                        Color.clear
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase)
                .onAppear {
                    withAnimation(
                        .linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                    ) {
                        phase = 300
                    }
                }
            }
            .clipped()
    }
}

extension View {

    /// Applies a shimmer loading animation to the view.
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Shimmer Placeholder

/// A rectangular shimmer placeholder used in skeleton loading screens.
struct ShimmerPlaceholder: View {

    let width: CGFloat?
    let height: CGFloat

    init(width: CGFloat? = nil, height: CGFloat = 20) {
        self.width = width
        self.height = height
    }

    var body: some View {
        RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.xs)
            .fill(AlgoTheme.Colors.disabled.opacity(0.3))
            .frame(width: width, height: height)
            .shimmer()
    }
}

// MARK: - Preview

#Preview("Loading Views") {
    VStack(spacing: 40) {
        LoadingView(message: "Fetching dashboard...")

        ShimmerPlaceholder(height: 60)
            .padding()

        ShimmerPlaceholder(width: 200, height: 16)
    }
}
