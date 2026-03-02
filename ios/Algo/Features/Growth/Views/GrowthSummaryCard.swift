// GrowthSummaryCard.swift
// Algo
//
// Summary card displayed at the top of the Growth screen.
// Shows the AI-generated headline, channel health scores as
// horizontal progress bars, and urgent items with warning icons.

import SwiftUI

// MARK: - GrowthSummaryCard

/// Displays a high-level growth summary with channel scores and urgent items.
///
/// Layout:
/// 1. Headline text
/// 2. Channel scores as labeled horizontal progress bars
/// 3. Urgent items list with warning icons
///
/// Usage:
/// ```swift
/// GrowthSummaryCard(summary: growthSummary)
/// ```
struct GrowthSummaryCard: View {

    // MARK: Properties

    /// The growth summary data to display.
    let summary: GrowthSummary

    // MARK: Body

    var body: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.md) {
            // Headline
            headlineSection

            // Channel Scores
            if !summary.channelScores.isEmpty {
                channelScoresSection
            }

            // Urgent Items
            if !summary.urgentItems.isEmpty {
                urgentItemsSection
            }
        }
        .padding(AlgoTheme.Spacing.md)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .algoShadow(AlgoTheme.Shadow.sm)
    }

    // MARK: Headline Section

    private var headlineSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AlgoTheme.Colors.secondary)

                Text("Growth Summary")
                    .font(AlgoTypography.labelMedium)
                    .foregroundStyle(AlgoTheme.Colors.textTertiary)
            }

            Text(summary.headline)
                .font(AlgoTypography.bodyMedium)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Channel Scores Section

    private var channelScoresSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            Text("Channel Health")
                .font(AlgoTypography.labelMedium)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)

            ForEach(summary.channelScores) { channel in
                channelRow(channel)
            }
        }
    }

    // MARK: Channel Row

    private func channelRow(_ channel: ChannelScore) -> some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
            HStack {
                Image(systemName: channelIcon(for: channel.platform))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)

                Text(channel.platform.capitalized)
                    .font(AlgoTypography.labelSmall)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)

                Spacer()

                // Trend indicator
                Image(systemName: trendIcon(for: channel.trend))
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(trendColor(for: channel.trend))

                Text("\(Int(channel.overallScore))")
                    .font(AlgoTypography.labelSmall)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)
            }

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.xs)
                        .fill(AlgoTheme.Colors.secondaryBackground)
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.xs)
                        .fill(scoreColor(for: channel.overallScore))
                        .frame(width: geometry.size.width * CGFloat(channel.overallScore / 100.0), height: 6)
                }
            }
            .frame(height: 6)
        }
    }

    // MARK: Urgent Items Section

    private var urgentItemsSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xs) {
            HStack(spacing: AlgoTheme.Spacing.xxs) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AlgoTheme.Colors.warning)

                Text("Urgent")
                    .font(AlgoTypography.labelMedium)
                    .foregroundStyle(AlgoTheme.Colors.warning)
            }

            ForEach(summary.urgentItems, id: \.self) { item in
                HStack(alignment: .top, spacing: AlgoTheme.Spacing.xs) {
                    Circle()
                        .fill(AlgoTheme.Colors.warning)
                        .frame(width: 6, height: 6)
                        .padding(.top, 6)

                    Text(item)
                        .font(AlgoTypography.bodySmall)
                        .foregroundStyle(AlgoTheme.Colors.textPrimary)
                }
            }
        }
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.warning.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
    }

    // MARK: Style Helpers

    /// SF Symbol name for a marketing channel platform.
    private func channelIcon(for platform: String) -> String {
        switch platform.lowercased() {
        case "whatsapp":   return "message.fill"
        case "instagram":  return "camera.fill"
        case "facebook":   return "person.2.fill"
        case "email":      return "envelope.fill"
        case "twitter", "x": return "at"
        case "linkedin":   return "briefcase.fill"
        default:           return "globe"
        }
    }

    /// SF Symbol name for a trend direction.
    private func trendIcon(for trend: String) -> String {
        switch trend.lowercased() {
        case "improving": return "arrow.up.right"
        case "declining": return "arrow.down.right"
        default:          return "minus"
        }
    }

    /// Color for a trend direction.
    private func trendColor(for trend: String) -> Color {
        switch trend.lowercased() {
        case "improving": return AlgoTheme.Colors.success
        case "declining": return AlgoTheme.Colors.error
        default:          return AlgoTheme.Colors.textSecondary
        }
    }

    /// Color for a channel score progress bar.
    private func scoreColor(for score: Double) -> Color {
        switch score {
        case 75...:     return AlgoTheme.Colors.success
        case 50..<75:   return AlgoTheme.Colors.warning
        default:        return AlgoTheme.Colors.error
        }
    }
}

// MARK: - Preview

#Preview("Growth Summary Card") {
    GrowthSummaryCard(
        summary: GrowthSummary(
            period: "last_7_days",
            headline: "Strong growth this week. Leads up 15% and engagement rates are improving across all channels. Focus on converting the 3 hot leads before they cool down.",
            kpiChanges: [],
            channelScores: [
                ChannelScore(
                    platform: "whatsapp",
                    engagementRate: 78.5,
                    leadConversionProxy: 65.0,
                    costEfficiency: 82.0,
                    overallScore: 75.2,
                    trend: "improving",
                    recommendation: nil
                ),
                ChannelScore(
                    platform: "instagram",
                    engagementRate: 62.3,
                    leadConversionProxy: 45.0,
                    costEfficiency: 71.0,
                    overallScore: 59.4,
                    trend: "stable",
                    recommendation: "Consider posting more Reels"
                ),
                ChannelScore(
                    platform: "email",
                    engagementRate: 34.2,
                    leadConversionProxy: 55.0,
                    costEfficiency: 90.0,
                    overallScore: 59.7,
                    trend: "declining",
                    recommendation: nil
                )
            ],
            topRecommendations: [],
            urgentItems: [
                "3 hot leads need follow-up within 24 hours",
                "Spring Sale campaign budget depleting faster than expected"
            ]
        )
    )
    .padding()
}
