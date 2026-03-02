// MetricsCard.swift
// Algo
//
// Rich data card for rendering structured performance metrics inside
// assistant message bubbles. Supports grid layout for key-value pairs,
// platform icons, and embedded chart visualization.

import SwiftUI

// MARK: - MetricsCard

struct MetricsCard: View {

    // MARK: - Properties

    /// The structured data containing metrics to display.
    let structuredData: StructuredData

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            // Header with data type label
            headerSection

            // Chart visualization if chart data is available
            if structuredData.isChartData {
                AlgoChartView(structuredData: structuredData)
                    .frame(height: 160)
            }

            // Metric entries grid
            metricsGrid

            // Time range label
            if let timeRange = structuredData.timeRange {
                timeRangeLabel(timeRange)
            }
        }
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .algoShadow(AlgoTheme.Shadow.sm)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Performance metrics")
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            Image(systemName: headerIcon)
                .font(.system(size: AlgoTheme.IconSize.sm))
                .foregroundStyle(AlgoTheme.Colors.primary)

            Text(headerTitle)
                .font(AlgoTypography.labelLarge)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)

            Spacer()
        }
    }

    // MARK: - Metrics Grid

    private var metricsGrid: some View {
        let entries = structuredData.metricEntries
        return ForEach(entries) { entry in
            metricRow(for: entry)
        }
    }

    private func metricRow(for entry: MetricEntry) -> some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
            // Platform or label header
            if let platform = entry.platform {
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    platformIcon(for: platform)
                    Text(platform.capitalized)
                        .font(AlgoTypography.labelMedium)
                        .foregroundStyle(AlgoTheme.Colors.textPrimary)
                }
            } else if let label = entry.label {
                Text(label)
                    .font(AlgoTypography.labelMedium)
                    .foregroundStyle(AlgoTheme.Colors.textPrimary)
            }

            // Key-value pairs in a flowing grid
            let pairs = entry.displayPairs
            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: AlgoTheme.Spacing.xs),
                    GridItem(.flexible(), spacing: AlgoTheme.Spacing.xs)
                ],
                alignment: .leading,
                spacing: AlgoTheme.Spacing.xxs
            ) {
                ForEach(pairs, id: \.key) { pair in
                    metricPairCell(key: pair.key, value: pair.value)
                }
            }
        }
        .padding(.vertical, AlgoTheme.Spacing.xxs)
    }

    private func metricPairCell(key: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(key)
                .font(AlgoTypography.caption)
                .foregroundStyle(AlgoTheme.Colors.textTertiary)

            Text(value)
                .font(AlgoTypography.metricSmall)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(key): \(value)")
    }

    // MARK: - Platform Icon

    private func platformIcon(for platform: String) -> some View {
        let icon: String
        let color: Color

        switch platform.lowercased() {
        case "instagram":
            icon = "camera.fill"
            color = Color(red: 0.83, green: 0.18, blue: 0.42)
        case "facebook":
            icon = "person.2.fill"
            color = Color(red: 0.23, green: 0.35, blue: 0.60)
        case "twitter", "x":
            icon = "bubble.left.fill"
            color = Color(red: 0.11, green: 0.63, blue: 0.95)
        case "linkedin":
            icon = "briefcase.fill"
            color = Color(red: 0.0, green: 0.47, blue: 0.71)
        case "whatsapp":
            icon = "message.fill"
            color = Color(red: 0.15, green: 0.68, blue: 0.38)
        case "email":
            icon = "envelope.fill"
            color = AlgoTheme.Colors.primary
        default:
            icon = "chart.bar.fill"
            color = AlgoTheme.Colors.primary
        }

        return Image(systemName: icon)
            .font(.system(size: 14))
            .foregroundStyle(color)
    }

    // MARK: - Time Range

    private func timeRangeLabel(_ timeRange: String) -> some View {
        HStack {
            Spacer()
            Text(timeRange.replacingOccurrences(of: "_", with: " ").capitalized)
                .font(AlgoTypography.caption)
                .foregroundStyle(AlgoTheme.Colors.textTertiary)
        }
    }

    // MARK: - Header Helpers

    private var headerTitle: String {
        switch structuredData.type {
        case StructuredData.DataType.performanceSummary:
            return "Performance Summary"
        case StructuredData.DataType.actionResult:
            return "Action Result"
        default:
            return "Data Summary"
        }
    }

    private var headerIcon: String {
        switch structuredData.type {
        case StructuredData.DataType.performanceSummary:
            return "chart.bar.xaxis"
        case StructuredData.DataType.actionResult:
            return "checkmark.circle"
        default:
            return "tablecells"
        }
    }
}

// MARK: - Preview

#Preview("Metrics Card") {
    ScrollView {
        VStack(spacing: 16) {
            MetricsCard(
                structuredData: StructuredData(
                    type: StructuredData.DataType.performanceSummary,
                    metrics: [
                        [
                            "platform": .string("instagram"),
                            "likes": .int(1203),
                            "comments": .int(89),
                            "shares": .int(45)
                        ],
                        [
                            "platform": .string("facebook"),
                            "likes": .int(890),
                            "comments": .int(67),
                            "shares": .int(456)
                        ],
                        [
                            "platform": .string("twitter"),
                            "likes": .int(234),
                            "comments": .int(12),
                            "shares": .int(51)
                        ]
                    ],
                    chartType: "bar",
                    timeRange: "today",
                    action: nil,
                    status: nil,
                    target: nil,
                    campaignId: nil
                )
            )
        }
        .padding()
    }
}
