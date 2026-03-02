// OnboardingView.swift
// Algo
//
// First-launch onboarding flow that introduces users to Algo's
// key features. Displays a paged walkthrough with illustrations,
// titles, and descriptions. Dismissed by tapping "Get Started"
// on the final page; completion state is persisted via AppStorage.

import SwiftUI

// MARK: - OnboardingView

struct OnboardingView: View {

    // MARK: - Properties

    @AppStorage("hasCompletedOnboarding") private var hasCompleted = false
    @State private var currentPage = 0

    /// The onboarding page definitions.
    private let pages: [(icon: String, title: String, description: String)] = [
        (
            "bubble.left.and.bubble.right.fill",
            "Meet Algo",
            "Your AI-powered growth assistant that understands your business"
        ),
        (
            "mic.fill",
            "Voice & Text",
            "Ask questions naturally — by typing or speaking. Algo understands context."
        ),
        (
            "chart.line.uptrend.xyaxis",
            "Growth Copilot",
            "Get AI recommendations with confidence scores. Accept with one tap."
        ),
        (
            "bell.badge.fill",
            "Proactive Alerts",
            "Never miss a hot lead or campaign issue. Algo watches 24/7."
        ),
    ]

    // MARK: - Body

    var body: some View {
        VStack {
            TabView(selection: $currentPage) {
                ForEach(pages.indices, id: \.self) { index in
                    onboardingPage(at: index)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))

            actionButton
        }
        .background(AlgoTheme.Colors.background)
    }

    // MARK: - Page Content

    private func onboardingPage(at index: Int) -> some View {
        VStack(spacing: AlgoTheme.Spacing.xl) {
            Spacer()

            Image(systemName: pages[index].icon)
                .font(.system(size: 80))
                .foregroundStyle(AlgoTheme.Colors.primary)

            Text(pages[index].title)
                .font(AlgoTypography.displayLarge)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)

            Text(pages[index].description)
                .font(AlgoTypography.bodyMedium)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Spacer()
        }
    }

    // MARK: - Action Button

    private var actionButton: some View {
        Button(currentPage == pages.count - 1 ? "Get Started" : "Next") {
            if currentPage == pages.count - 1 {
                hasCompleted = true
            } else {
                withAnimation {
                    currentPage += 1
                }
            }
        }
        .buttonStyle(.borderedProminent)
        .controlSize(.large)
        .padding(.bottom, 40)
    }
}

// MARK: - Preview

#Preview("Onboarding") {
    OnboardingView()
}
