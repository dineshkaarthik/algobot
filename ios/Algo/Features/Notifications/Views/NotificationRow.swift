// NotificationRow.swift
// Algo
//
// A single notification row displaying type icon, title, body,
// relative timestamp, and unread indicator. Supports swipe-to-mark-read.

import SwiftUI

// MARK: - NotificationRow

/// Displays a single notification item in the notification list.
///
/// Features:
/// - Type-colored icon based on notification category
/// - Bold title and body preview
/// - Relative timestamp (e.g., "2h ago")
/// - Blue unread indicator dot
/// - Swipe action to mark as read
struct NotificationRow: View {

    // MARK: Properties

    /// The notification to display.
    let notification: AppNotification

    /// Closure called when the user swipes to mark as read.
    let onMarkAsRead: () -> Void

    /// Closure called when the row is tapped.
    let onTap: () -> Void

    // MARK: Body

    var body: some View {
        Button(action: onTap) {
            HStack(alignment: .top, spacing: AlgoTheme.Spacing.sm) {
                // Type icon
                Image(systemName: notification.iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(severityColor)
                    .frame(width: 36, height: 36)
                    .background(severityColor.opacity(0.1))
                    .clipShape(Circle())

                // Content
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
                    HStack(alignment: .top) {
                        Text(notification.title)
                            .font(notification.read ? AlgoTypography.bodySmall : AlgoTypography.labelMedium)
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)
                            .lineLimit(1)

                        Spacer()

                        Text(formattedTimestamp)
                            .font(AlgoTypography.caption)
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }

                    Text(notification.body)
                        .font(AlgoTypography.bodySmall)
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                        .lineLimit(2)

                    // Type badge
                    Text(notification.typeLabel)
                        .font(AlgoTypography.labelSmall)
                        .foregroundStyle(severityColor)
                        .padding(.horizontal, AlgoTheme.Spacing.xs)
                        .padding(.vertical, 2)
                        .background(severityColor.opacity(0.1))
                        .clipShape(Capsule())
                }

                // Unread indicator
                if !notification.read {
                    Circle()
                        .fill(AlgoTheme.Colors.primary)
                        .frame(width: 8, height: 8)
                        .padding(.top, 4)
                }
            }
            .padding(.vertical, AlgoTheme.Spacing.xs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing) {
            if !notification.read {
                Button {
                    onMarkAsRead()
                } label: {
                    Label("Read", systemImage: "envelope.open")
                }
                .tint(AlgoTheme.Colors.primary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(notification.title). \(notification.body)")
        .accessibilityHint(notification.read ? "" : "Unread notification")
    }

    // MARK: Helpers

    /// Color based on the notification severity.
    private var severityColor: Color {
        Color.forSeverity(notification.severity)
    }

    /// Formats the notification timestamp to a relative time string.
    private var formattedTimestamp: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let date: Date? = formatter.date(from: notification.createdAt) ?? {
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: notification.createdAt)
        }()

        guard let date else { return notification.createdAt }

        let relativeFormatter = RelativeDateTimeFormatter()
        relativeFormatter.unitsStyle = .abbreviated
        return relativeFormatter.localizedString(for: date, relativeTo: .now)
    }
}

// MARK: - Preview

#Preview("Notification Rows") {
    List {
        NotificationRow(
            notification: AppNotification(
                id: "notif_001",
                type: "hot_lead",
                title: "Hot Lead Detected",
                body: "Sarah Johnson from TechCorp has high engagement score (92/100)",
                severity: "high",
                read: false,
                actionUrl: "/leads/lead_sarah_001",
                createdAt: "2026-03-01T14:20:00Z"
            ),
            onMarkAsRead: {},
            onTap: {}
        )

        NotificationRow(
            notification: AppNotification(
                id: "notif_002",
                type: "campaign_drop",
                title: "Campaign Performance Drop",
                body: "Spring Sale campaign engagement dropped 23% in the last hour",
                severity: "medium",
                read: true,
                actionUrl: nil,
                createdAt: "2026-03-01T10:00:00Z"
            ),
            onMarkAsRead: {},
            onTap: {}
        )

        NotificationRow(
            notification: AppNotification(
                id: "notif_003",
                type: "credit_low",
                title: "AI Credits Running Low",
                body: "You have 500 credits remaining out of 10,000. Consider upgrading.",
                severity: "low",
                read: false,
                actionUrl: nil,
                createdAt: "2026-02-28T09:00:00Z"
            ),
            onMarkAsRead: {},
            onTap: {}
        )
    }
    .listStyle(.plain)
}
