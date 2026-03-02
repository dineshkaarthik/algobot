// MessageBubble.swift
// Algo
//
// Individual message bubble view. Renders user messages right-aligned with
// accent color and assistant messages left-aligned with a light background.
// Supports structured data cards, confirmation cards, and timestamps.

import SwiftUI

// MARK: - MessageBubble

struct MessageBubble: View {

    // MARK: - Properties

    let message: Message

    /// Callback invoked when the user responds to a confirmation card.
    /// Parameters: (confirmationId, confirmed)
    var onConfirm: ((String, Bool) -> Void)?

    // MARK: - Body

    var body: some View {
        HStack(alignment: .bottom, spacing: AlgoTheme.Spacing.xs) {
            if message.isUser {
                Spacer(minLength: 60)
            }

            VStack(alignment: message.isUser ? .trailing : .leading, spacing: AlgoTheme.Spacing.xxs) {
                // Main message content
                bubbleContent

                // Structured data card (performance metrics, action results)
                if message.hasStructuredData, let structuredData = message.structuredData {
                    structuredDataCard(for: structuredData)
                }

                // Confirmation card for actions requiring approval
                if message.needsConfirmation, let confirmationId = message.confirmationId {
                    ConfirmationCard(
                        structuredData: message.structuredData,
                        onConfirm: {
                            onConfirm?(confirmationId, true)
                        },
                        onCancel: {
                            onConfirm?(confirmationId, false)
                        }
                    )
                }

                // Timestamp
                timestamp
            }

            if message.isAssistant {
                Spacer(minLength: 60)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
    }

    // MARK: - Bubble Content

    private var bubbleContent: some View {
        Text(message.content)
            .font(AlgoTypography.bodyMedium)
            .foregroundStyle(message.isUser ? AlgoTheme.Colors.textOnPrimary : AlgoTheme.Colors.textPrimary)
            .padding(.horizontal, AlgoTheme.Spacing.sm)
            .padding(.vertical, AlgoTheme.Spacing.xs)
            .background(bubbleBackground)
            .clipShape(bubbleShape)
    }

    private var bubbleBackground: Color {
        message.isUser ? AlgoTheme.Colors.primary : AlgoTheme.Colors.secondaryBackground
    }

    private var bubbleShape: some Shape {
        RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.lg)
    }

    // MARK: - Structured Data

    @ViewBuilder
    private func structuredDataCard(for data: StructuredData) -> some View {
        switch data.type {
        case StructuredData.DataType.performanceSummary:
            MetricsCard(structuredData: data)

        case StructuredData.DataType.actionResult:
            actionResultCard(for: data)

        case StructuredData.DataType.actionConfirmation:
            // Confirmation is handled separately by ConfirmationCard above
            EmptyView()

        default:
            // Generic metrics display for unknown types
            if !data.metricEntries.isEmpty {
                MetricsCard(structuredData: data)
            }
        }
    }

    /// Displays the result of a completed action (success/failure).
    private func actionResultCard(for data: StructuredData) -> some View {
        HStack(spacing: AlgoTheme.Spacing.xs) {
            Image(systemName: data.status == "success" ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundStyle(data.status == "success" ? AlgoTheme.Colors.success : AlgoTheme.Colors.error)
                .font(.system(size: AlgoTheme.IconSize.md))

            VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxxs) {
                Text(data.action?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Action")
                    .font(AlgoTypography.labelMedium)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)

                Text(data.status == "success" ? "Completed successfully" : "Action failed")
                    .font(AlgoTypography.caption)
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
            }
        }
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.secondaryBackground)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
    }

    // MARK: - Timestamp

    private var timestamp: some View {
        Text(message.timestamp.timeString)
            .font(AlgoTypography.caption)
            .foregroundStyle(AlgoTheme.Colors.textTertiary)
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        let role = message.isUser ? "You" : "Algo"
        let time = message.timestamp.timeString
        var description = "\(role) said: \(message.content), at \(time)"

        if message.needsConfirmation {
            description += ". This message requires your confirmation."
        }
        if message.hasStructuredData {
            description += ". Contains additional data."
        }

        return description
    }
}

// MARK: - Preview

#Preview("Message Bubbles") {
    ScrollView {
        VStack(spacing: 12) {
            MessageBubble(
                message: Message(
                    role: .user,
                    content: "How did my social media campaigns perform today?"
                )
            )

            MessageBubble(
                message: Message(
                    role: .assistant,
                    content: "Your social media campaigns today generated 2,847 total engagements across all platforms. Instagram led with 1,203 likes and 89 comments."
                )
            )

            MessageBubble(
                message: Message(
                    role: .assistant,
                    content: "I found the 'Spring Sale' campaign. Are you sure you want to pause it?",
                    requiresConfirmation: true,
                    confirmationId: "cfm_preview"
                ),
                onConfirm: { id, confirmed in
                    print("Confirmation \(id): \(confirmed)")
                }
            )
        }
        .padding()
    }
}
