// ConfirmationCard.swift
// Algo
//
// Action confirmation card displayed within assistant messages when the
// AI proposes a write operation (pause campaign, send email, etc.).
// Shows action details and Confirm/Cancel buttons.

import SwiftUI

// MARK: - ConfirmationCard

struct ConfirmationCard: View {

    // MARK: - Properties

    /// Optional structured data containing action details and target info.
    let structuredData: StructuredData?

    /// Callback invoked when the user confirms the action.
    let onConfirm: () -> Void

    /// Callback invoked when the user cancels the action.
    let onCancel: () -> Void

    /// Optional countdown timer for expiring confirmations.
    var expiresIn: TimeInterval?

    @State private var remainingTime: Int = 0
    @State private var isExpired = false

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            // Header with warning icon
            headerRow

            // Action details
            if let details = actionDetails {
                detailSection(details)
            }

            // Target info (campaign name, status, etc.)
            if let target = structuredData?.target {
                targetSection(target)
            }

            // Expiration countdown
            if let _ = expiresIn, !isExpired {
                expirationIndicator
            }

            // Action buttons
            if !isExpired {
                buttonRow
            } else {
                expiredNotice
            }
        }
        .padding(AlgoTheme.Spacing.md)
        .background(AlgoTheme.Colors.warning.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md)
                .strokeBorder(AlgoTheme.Colors.warning.opacity(0.3), lineWidth: 1)
        )
        .onAppear {
            startExpirationTimer()
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Action confirmation required")
    }

    // MARK: - Header

    private var headerRow: some View {
        HStack(spacing: AlgoTheme.Spacing.xs) {
            Image(systemName: isDestructive ? "exclamationmark.triangle.fill" : "checkmark.shield.fill")
                .font(.system(size: AlgoTheme.IconSize.md))
                .foregroundStyle(isDestructive ? AlgoTheme.Colors.warning : AlgoTheme.Colors.primary)

            Text("Action Confirmation")
                .font(AlgoTypography.labelLarge)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)

            Spacer()
        }
    }

    // MARK: - Details

    private func detailSection(_ details: String) -> some View {
        Text(details)
            .font(AlgoTypography.bodySmall)
            .foregroundStyle(AlgoTheme.Colors.textSecondary)
    }

    // MARK: - Target

    private func targetSection(_ target: [String: JSONValue]) -> some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
            ForEach(sortedTargetPairs(target), id: \.key) { pair in
                HStack {
                    Text(pair.key.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(AlgoTypography.caption)
                        .foregroundStyle(AlgoTheme.Colors.textTertiary)

                    Spacer()

                    Text(pair.value)
                        .font(AlgoTypography.captionBold)
                        .foregroundStyle(AlgoTheme.Colors.textPrimary)
                }
            }
        }
        .padding(AlgoTheme.Spacing.xs)
        .background(AlgoTheme.Colors.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
    }

    // MARK: - Expiration

    private var expirationIndicator: some View {
        HStack(spacing: AlgoTheme.Spacing.xxs) {
            Image(systemName: "clock")
                .font(.system(size: 12))

            Text("Expires in \(remainingTime)s")
                .font(AlgoTypography.caption)
        }
        .foregroundStyle(remainingTime <= 10 ? AlgoTheme.Colors.error : AlgoTheme.Colors.textTertiary)
    }

    private var expiredNotice: some View {
        Text("This confirmation has expired.")
            .font(AlgoTypography.bodySmall)
            .foregroundStyle(AlgoTheme.Colors.textTertiary)
            .italic()
    }

    // MARK: - Buttons

    private var buttonRow: some View {
        HStack(spacing: AlgoTheme.Spacing.sm) {
            // Cancel button
            Button(action: onCancel) {
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                    Text("Cancel")
                }
                .font(AlgoTypography.labelMedium)
                .foregroundStyle(AlgoTheme.Colors.error)
                .frame(maxWidth: .infinity)
                .padding(.vertical, AlgoTheme.Spacing.xs)
                .background(AlgoTheme.Colors.error.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
            }
            .accessibilityLabel("Cancel action")

            // Confirm button
            Button(action: onConfirm) {
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                    Text("Confirm")
                }
                .font(AlgoTypography.labelMedium)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, AlgoTheme.Spacing.xs)
                .background(AlgoTheme.Colors.success)
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
            }
            .accessibilityLabel("Confirm action")
        }
    }

    // MARK: - Helpers

    /// Extracts a human-readable description of the pending action.
    private var actionDetails: String? {
        guard let action = structuredData?.action else { return nil }
        return action.replacingOccurrences(of: "_", with: " ").capitalized
    }

    /// Whether this action is potentially destructive (delete, pause, etc.).
    private var isDestructive: Bool {
        guard let action = structuredData?.action?.lowercased() else { return false }
        return action.contains("delete") || action.contains("pause") || action.contains("remove")
    }

    /// Converts target dictionary into sorted display pairs.
    private func sortedTargetPairs(_ target: [String: JSONValue]) -> [(key: String, value: String)] {
        target.compactMap { key, value -> (String, String)? in
            switch value {
            case .string(let s): return (key, s)
            case .int(let i): return (key, "\(i)")
            case .double(let d): return (key, String(format: "%.2f", d))
            case .bool(let b): return (key, b ? "Yes" : "No")
            default: return nil
            }
        }
        .sorted { $0.key < $1.key }
    }

    /// Starts the expiration countdown timer.
    private func startExpirationTimer() {
        guard let expiresIn, expiresIn > 0 else { return }

        remainingTime = Int(expiresIn)

        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            Task { @MainActor in
                remainingTime -= 1
                if remainingTime <= 0 {
                    timer.invalidate()
                    isExpired = true
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Confirmation Cards") {
    ScrollView {
        VStack(spacing: 20) {
            ConfirmationCard(
                structuredData: StructuredData(
                    type: StructuredData.DataType.actionConfirmation,
                    metrics: nil,
                    chartType: nil,
                    timeRange: nil,
                    action: "PAUSE_CAMPAIGN",
                    status: nil,
                    target: [
                        "campaign_name": .string("Spring Sale"),
                        "status": .string("active"),
                        "today_impressions": .int(12345)
                    ],
                    campaignId: nil
                ),
                onConfirm: { print("Confirmed") },
                onCancel: { print("Cancelled") }
            )

            ConfirmationCard(
                structuredData: StructuredData(
                    type: StructuredData.DataType.actionConfirmation,
                    metrics: nil,
                    chartType: nil,
                    timeRange: nil,
                    action: "DELETE_CAMPAIGN",
                    status: nil,
                    target: ["campaign_name": .string("Old Campaign")],
                    campaignId: nil
                ),
                onConfirm: {},
                onCancel: {},
                expiresIn: 30
            )
        }
        .padding()
    }
}
