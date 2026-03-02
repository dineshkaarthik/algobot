// ExecutionHistoryView.swift
// Algo
//
// Displays the history of executed recommendation actions.
// Shows each execution entry with action type, result status,
// and execution timestamp.

import SwiftUI

// MARK: - ExecutionHistoryView

/// Lists previously executed recommendation actions with their outcomes.
///
/// Layout:
/// - Navigation title "Execution History"
/// - List of `ExecutionEntry` items as rows
/// - Each row shows action type, result badge, and timestamp
/// - Empty state when no executions exist
struct ExecutionHistoryView: View {

    // MARK: Properties

    /// The list of execution entries to display.
    let executions: [ExecutionEntry]

    // MARK: Body

    var body: some View {
        Group {
            if executions.isEmpty {
                emptyState
            } else {
                executionList
            }
        }
        .navigationTitle("Execution History")
    }

    // MARK: Execution List

    private var executionList: some View {
        ScrollView {
            LazyVStack(spacing: AlgoTheme.Spacing.sm) {
                ForEach(executions) { entry in
                    executionRow(entry)
                }
            }
            .padding(AlgoTheme.Spacing.md)
        }
    }

    // MARK: Execution Row

    private func executionRow(_ entry: ExecutionEntry) -> some View {
        HStack(spacing: AlgoTheme.Spacing.sm) {
            // Result icon
            Image(systemName: resultIcon(for: entry.result))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(resultColor(for: entry.result))
                .frame(width: 32, height: 32)
                .background(resultColor(for: entry.result).opacity(0.12))
                .clipShape(Circle())

            // Content
            VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxxs) {
                // Action type
                Text(formattedActionType(entry.actionType))
                    .font(AlgoTypography.labelMedium)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)
                    .lineLimit(1)

                // Result and error
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    resultBadge(for: entry.result)

                    if let error = entry.error {
                        Text(error)
                            .font(AlgoTypography.caption)
                            .foregroundStyle(AlgoTheme.Colors.error)
                            .lineLimit(1)
                    }
                }

                // Timestamp
                Text(formattedTimestamp(entry.executedAt))
                    .font(AlgoTypography.caption)
                    .foregroundStyle(AlgoTheme.Colors.textTertiary)
            }

            Spacer()
        }
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
        .algoShadow(AlgoTheme.Shadow.sm)
    }

    // MARK: Result Badge

    private func resultBadge(for result: String) -> some View {
        Text(result.capitalized)
            .font(AlgoTypography.labelSmall)
            .foregroundStyle(resultColor(for: result))
            .padding(.horizontal, AlgoTheme.Spacing.xs)
            .padding(.vertical, AlgoTheme.Spacing.xxxs)
            .background(resultColor(for: result).opacity(0.12))
            .clipShape(Capsule())
    }

    // MARK: Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Executions", systemImage: "clock.arrow.circlepath")
        } description: {
            Text("Actions you execute from recommendations will appear here.")
                .font(AlgoTypography.bodySmall)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)
        }
    }

    // MARK: Style Helpers

    /// SF Symbol name for a result status.
    private func resultIcon(for result: String) -> String {
        switch result.lowercased() {
        case "success":  return "checkmark.circle.fill"
        case "failed":   return "xmark.circle.fill"
        default:         return "questionmark.circle.fill"
        }
    }

    /// Color for a result status.
    private func resultColor(for result: String) -> Color {
        switch result.lowercased() {
        case "success":  return AlgoTheme.Colors.success
        case "failed":   return AlgoTheme.Colors.error
        default:         return AlgoTheme.Colors.textSecondary
        }
    }

    /// Formats a snake_case action type into a human-readable string.
    private func formattedActionType(_ type: String) -> String {
        type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    /// Formats an ISO 8601 timestamp into a relative time string.
    private func formattedTimestamp(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: isoString) else {
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: isoString) else {
                return isoString
            }
            return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: .now)
        }

        let relativeFormatter = RelativeDateTimeFormatter()
        relativeFormatter.unitsStyle = .abbreviated
        return relativeFormatter.localizedString(for: date, relativeTo: .now)
    }
}

// MARK: - Preview

#Preview("Execution History") {
    NavigationStack {
        ExecutionHistoryView(
            executions: [
                ExecutionEntry(
                    id: "exec_001",
                    recommendationId: "rec_001",
                    actionType: "schedule_social_post",
                    beforeState: nil,
                    afterState: nil,
                    result: "success",
                    error: nil,
                    executedAt: "2026-03-01T14:30:00Z"
                ),
                ExecutionEntry(
                    id: "exec_002",
                    recommendationId: "rec_002",
                    actionType: "send_followup",
                    beforeState: nil,
                    afterState: nil,
                    result: "failed",
                    error: "Lead contact info missing",
                    executedAt: "2026-03-01T13:15:00Z"
                ),
                ExecutionEntry(
                    id: "exec_003",
                    recommendationId: "rec_003",
                    actionType: "adjust_budget",
                    beforeState: ["daily_budget": "50"],
                    afterState: ["daily_budget": "35"],
                    result: "success",
                    error: nil,
                    executedAt: "2026-02-28T16:45:00Z"
                )
            ]
        )
    }
}
