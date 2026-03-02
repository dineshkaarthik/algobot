// QuickActionsGrid.swift
// Algo
//
// A 2x2 grid of quick action shortcut buttons.
// Each button navigates to a key feature of the app.

import SwiftUI

// MARK: - QuickAction

/// Represents a single quick action shortcut.
struct QuickAction: Identifiable {
    let id: String
    let title: String
    let icon: String
    let color: Color
    let destination: AppDestination
}

// MARK: - AppDestination

/// Represents navigation destinations for quick actions.
enum AppDestination: Hashable {
    case newChat
    case leads
    case campaigns
    case credits
}

// MARK: - QuickActionsGrid

/// Displays a 2x2 grid of quick action buttons for common tasks.
///
/// Usage:
/// ```swift
/// QuickActionsGrid { destination in
///     router.navigate(to: destination)
/// }
/// ```
struct QuickActionsGrid: View {

    // MARK: Properties

    /// Closure called when a quick action is tapped.
    let onAction: (AppDestination) -> Void

    // MARK: Default Actions

    /// The predefined set of quick actions.
    private let actions: [QuickAction] = [
        QuickAction(
            id: "new_chat",
            title: "New Chat",
            icon: "bubble.left.and.bubble.right.fill",
            color: Color.AlgoDefaults.blue,
            destination: .newChat
        ),
        QuickAction(
            id: "view_leads",
            title: "View Leads",
            icon: "person.2.fill",
            color: Color.AlgoDefaults.green,
            destination: .leads
        ),
        QuickAction(
            id: "campaigns",
            title: "Campaigns",
            icon: "megaphone.fill",
            color: Color.AlgoDefaults.purple,
            destination: .campaigns
        ),
        QuickAction(
            id: "credits",
            title: "AI Credits",
            icon: "cpu.fill",
            color: Color.AlgoDefaults.orange,
            destination: .credits
        )
    ]

    // MARK: Body

    var body: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: AlgoTheme.Spacing.sm),
                GridItem(.flexible(), spacing: AlgoTheme.Spacing.sm)
            ],
            spacing: AlgoTheme.Spacing.sm
        ) {
            ForEach(actions) { action in
                QuickActionButton(action: action) {
                    onAction(action.destination)
                }
            }
        }
    }
}

// MARK: - QuickActionButton

/// A single quick action button with icon, label, and tap handler.
private struct QuickActionButton: View {

    let action: QuickAction
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: AlgoTheme.Spacing.xs) {
                Image(systemName: action.icon)
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(action.color)
                    .frame(width: 44, height: 44)
                    .background(action.color.opacity(0.1))
                    .clipShape(Circle())

                Text(action.title)
                    .font(AlgoTypography.labelMedium)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, AlgoTheme.Spacing.md)
            .background(AlgoTheme.Colors.surface)
            .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
            .algoShadow(AlgoTheme.Shadow.sm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.title)
    }
}

// MARK: - Preview

#Preview("Quick Actions Grid") {
    QuickActionsGrid { destination in
        print("Navigate to: \(destination)")
    }
    .padding()
}
