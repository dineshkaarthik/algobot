// AlertCard.swift
// Algo
//
// Alert notification card with severity-colored left border,
// title, message, timestamp, and optional action button.

import SwiftUI

// MARK: - AlertCard

/// Displays an alert item as a card with a severity-colored accent border.
///
/// Usage:
/// ```swift
/// AlertCard(alert: alertItem) { action in
///     handleAlertAction(action)
/// }
/// ```
struct AlertCard: View {

    // MARK: Properties

    /// The alert data to display.
    let alert: AlertItem

    /// Closure called when the action button is tapped.
    let onAction: ((AlertAction) -> Void)?

    // MARK: Initialization

    init(alert: AlertItem, onAction: ((AlertAction) -> Void)? = nil) {
        self.alert = alert
        self.onAction = onAction
    }

    // MARK: Body

    var body: some View {
        HStack(spacing: 0) {
            // Severity-colored left border
            Rectangle()
                .fill(severityColor)
                .frame(width: 4)

            // Content
            HStack(spacing: AlgoTheme.Spacing.sm) {
                // Type icon
                Image(systemName: alert.iconName)
                    .font(.system(size: 18))
                    .foregroundStyle(severityColor)
                    .frame(width: 32, height: 32)
                    .background(severityColor.opacity(0.1))
                    .clipShape(Circle())

                // Text content
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
                    HStack {
                        Text(alert.title)
                            .font(AlgoTypography.labelMedium)
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)
                            .lineLimit(1)

                        Spacer()

                        Text(formattedTimestamp)
                            .font(AlgoTypography.caption)
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }

                    Text(alert.message)
                        .font(AlgoTypography.bodySmall)
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                        .lineLimit(2)

                    // Action button
                    if let action = alert.action, onAction != nil {
                        Button {
                            onAction?(action)
                        } label: {
                            Text(actionLabel(for: action.type))
                                .font(AlgoTypography.labelSmall)
                                .foregroundStyle(AlgoTheme.Colors.primary)
                        }
                        .padding(.top, AlgoTheme.Spacing.xxxs)
                    }
                }
            }
            .padding(AlgoTheme.Spacing.sm)
        }
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
        .algoShadow(AlgoTheme.Shadow.sm)
    }

    // MARK: Helpers

    /// Color corresponding to the alert severity level.
    private var severityColor: Color {
        Color.forSeverity(alert.severity)
    }

    /// Formats the alert timestamp to a relative time string.
    private var formattedTimestamp: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: alert.createdAt) else {
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: alert.createdAt) else {
                return alert.createdAt
            }
            return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: .now)
        }

        let relativeFormatter = RelativeDateTimeFormatter()
        relativeFormatter.unitsStyle = .abbreviated
        return relativeFormatter.localizedString(for: date, relativeTo: .now)
    }

    /// Returns a human-readable label for the action type.
    private func actionLabel(for type: String) -> String {
        switch type {
        case "VIEW_LEAD":     return "View Lead"
        case "VIEW_CAMPAIGN": return "View Campaign"
        case "VIEW_REPORT":   return "View Report"
        default:              return "View Details"
        }
    }
}

// MARK: - Preview

#Preview("Alert Cards") {
    VStack(spacing: 12) {
        AlertCard(
            alert: AlertItem(
                id: "alt_001",
                type: "hot_lead",
                severity: "high",
                title: "New hot lead detected",
                message: "Sarah Johnson from TechCorp scored 92/100",
                createdAt: "2026-03-01T14:20:00Z",
                action: AlertAction(type: "VIEW_LEAD", params: ["lead_id": "lead_001"])
            )
        ) { _ in }

        AlertCard(
            alert: AlertItem(
                id: "alt_002",
                type: "campaign_drop",
                severity: "medium",
                title: "Campaign performance drop",
                message: "Spring Sale campaign engagement dropped 23% in the last hour",
                createdAt: "2026-03-01T13:45:00Z",
                action: nil
            )
        )

        AlertCard(
            alert: AlertItem(
                id: "alt_003",
                type: "credit_low",
                severity: "low",
                title: "AI credits running low",
                message: "You have 500 credits remaining out of 10,000",
                createdAt: "2026-03-01T12:00:00Z",
                action: nil
            )
        )
    }
    .padding()
}
