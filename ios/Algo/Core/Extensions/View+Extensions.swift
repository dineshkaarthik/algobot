// View+Extensions.swift
// Algo
//
// SwiftUI view modifiers and extensions used throughout the Algo app.
// Provides reusable styling, keyboard management, and animation utilities.

import SwiftUI

// MARK: - Keyboard Dismissal

extension View {

    /// Dismisses the keyboard when the user taps outside of text fields.
    ///
    /// Usage:
    /// ```swift
    /// VStack {
    ///     TextField("Email", text: $email)
    /// }
    /// .hideKeyboard()
    /// ```
    func hideKeyboard() -> some View {
        self.onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        }
    }
}

// MARK: - Card Style

extension View {

    /// Applies a standard card appearance with rounded corners, background, and shadow.
    ///
    /// Usage:
    /// ```swift
    /// VStack {
    ///     Text("Dashboard Metric")
    /// }
    /// .cardStyle()
    /// ```
    func cardStyle(
        cornerRadius: CGFloat = 12,
        shadowRadius: CGFloat = 4,
        padding: CGFloat = 16
    ) -> some View {
        self
            .padding(padding)
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(0.08), radius: shadowRadius, x: 0, y: 2)
    }
}

// MARK: - Shimmer Effect

extension View {

    /// Applies a shimmer loading animation overlay.
    ///
    /// Used for skeleton loading states while data is being fetched.
    ///
    /// Usage:
    /// ```swift
    /// RoundedRectangle(cornerRadius: 8)
    ///     .frame(height: 20)
    ///     .shimmer(isActive: viewModel.isLoading)
    /// ```
    func shimmer(isActive: Bool = true) -> some View {
        self.modifier(ShimmerModifier(isActive: isActive))
    }
}

/// A view modifier that overlays an animated shimmer gradient.
struct ShimmerModifier: ViewModifier {
    let isActive: Bool

    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        if isActive {
            content
                .overlay {
                    GeometryReader { geometry in
                        LinearGradient(
                            colors: [
                                .clear,
                                .white.opacity(0.4),
                                .clear
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: geometry.size.width * 2)
                        .offset(x: -geometry.size.width + (phase * geometry.size.width * 3))
                    }
                    .clipped()
                }
                .onAppear {
                    withAnimation(
                        .linear(duration: 1.5)
                        .repeatForever(autoreverses: false)
                    ) {
                        phase = 1
                    }
                }
        } else {
            content
        }
    }
}

// MARK: - Conditional Modifier

extension View {

    /// Applies a view modifier conditionally.
    ///
    /// Usage:
    /// ```swift
    /// Text("Hello")
    ///     .if(isHighlighted) { view in
    ///         view.foregroundStyle(.yellow)
    ///     }
    /// ```
    @ViewBuilder
    func `if`<Content: View>(
        _ condition: Bool,
        transform: (Self) -> Content
    ) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// MARK: - Loading Overlay

extension View {

    /// Overlays a centered `ProgressView` when the condition is true.
    ///
    /// Usage:
    /// ```swift
    /// ContentView()
    ///     .loadingOverlay(isLoading: viewModel.isLoading)
    /// ```
    func loadingOverlay(isLoading: Bool, message: String? = nil) -> some View {
        self.overlay {
            if isLoading {
                ZStack {
                    Color.black.opacity(0.2)
                        .ignoresSafeArea()

                    VStack(spacing: 12) {
                        ProgressView()
                            .controlSize(.large)
                        if let message {
                            Text(message)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(24)
                    .background(.ultraThinMaterial)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
        }
    }
}

// MARK: - Error Alert

extension View {

    /// Presents an alert when the optional error binding is non-nil.
    ///
    /// Usage:
    /// ```swift
    /// ContentView()
    ///     .errorAlert(error: $viewModel.error)
    /// ```
    func errorAlert(error: Binding<(any LocalizedError)?>) -> some View {
        self.alert(
            "Error",
            isPresented: Binding<Bool>(
                get: { error.wrappedValue != nil },
                set: { if !$0 { error.wrappedValue = nil } }
            ),
            presenting: error.wrappedValue
        ) { _ in
            Button("OK", role: .cancel) {}
        } message: { err in
            Text(err.localizedDescription)
        }
    }
}

// MARK: - Scroll Fade

extension View {

    /// Applies a fade effect at the edges of a scroll view.
    func scrollFade(top: Bool = true, bottom: Bool = true) -> some View {
        self.mask {
            VStack(spacing: 0) {
                if top {
                    LinearGradient(
                        colors: [.clear, .black],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 20)
                }

                Color.black

                if bottom {
                    LinearGradient(
                        colors: [.black, .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 20)
                }
            }
        }
    }
}
