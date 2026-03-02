// SuggestedActionsBar.swift
// Algo
//
// Horizontally scrolling bar of suggested action chips displayed below
// the message list. Each chip triggers the corresponding action callback.

import SwiftUI

// MARK: - SuggestedActionsBar

struct SuggestedActionsBar: View {

    // MARK: - Properties

    /// The list of suggested actions to display as chips.
    let actions: [SuggestedAction]

    /// Callback invoked when a suggested action chip is tapped.
    let onAction: (SuggestedAction) -> Void

    @State private var hasAppeared = false

    // MARK: - Body

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                ForEach(actions) { action in
                    actionChip(for: action)
                }
            }
            .padding(.horizontal, AlgoTheme.Spacing.md)
            .padding(.vertical, AlgoTheme.Spacing.xs)
        }
        .onAppear {
            withAnimation(AlgoTheme.Animation.standard) {
                hasAppeared = true
            }
        }
        .opacity(hasAppeared ? 1.0 : 0.0)
        .offset(y: hasAppeared ? 0 : 8)
        .accessibilityLabel("Suggested actions")
    }

    // MARK: - Action Chip

    private func actionChip(for action: SuggestedAction) -> some View {
        Button {
            onAction(action)
        } label: {
            Text(action.label)
                .font(AlgoTypography.labelMedium)
                .foregroundStyle(AlgoTheme.Colors.primary)
                .padding(.horizontal, AlgoTheme.Spacing.sm)
                .padding(.vertical, AlgoTheme.Spacing.xs)
                .background(AlgoTheme.Colors.primary.opacity(0.1))
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .strokeBorder(AlgoTheme.Colors.primary.opacity(0.2), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.label)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Preview

#Preview("Suggested Actions Bar") {
    VStack {
        Spacer()
        SuggestedActionsBar(
            actions: [
                SuggestedAction(label: "View detailed report", action: "VIEW_REPORT", params: nil),
                SuggestedAction(label: "Compare with yesterday", action: "COMPARE", params: nil),
                SuggestedAction(label: "Show top campaigns", action: "TOP_CAMPAIGNS", params: nil),
                SuggestedAction(label: "Export data", action: "EXPORT", params: nil)
            ]
        ) { action in
            print("Tapped: \(action.label)")
        }
    }
}
