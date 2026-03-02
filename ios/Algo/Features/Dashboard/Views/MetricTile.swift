// MetricTile.swift
// Algo
//
// A compact card displaying a single business metric with an icon,
// title, formatted value, and optional trend indicator.

import SwiftUI

// MARK: - MetricTrend

/// Represents the directional trend of a metric value.
enum MetricTrend {
    /// Value is increasing (positive).
    case up
    /// Value is decreasing (negative).
    case down
    /// Value is unchanged or no trend data available.
    case neutral
}

// MARK: - MetricTile

/// Displays a single metric in a compact card format.
///
/// Usage:
/// ```swift
/// MetricTile(
///     icon: "flame.fill",
///     iconColor: .orange,
///     title: "Hot Leads",
///     value: "5",
///     trend: .up,
///     trendLabel: "+2 today"
/// )
/// ```
struct MetricTile: View {

    // MARK: Properties

    /// SF Symbol name for the metric icon.
    let icon: String

    /// Color applied to the icon background.
    let iconColor: Color

    /// Short label describing the metric.
    let title: String

    /// Formatted value string (e.g., "47", "$12,450").
    let value: String

    /// Trend direction for the arrow indicator.
    let trend: MetricTrend

    /// Optional label shown next to the trend arrow (e.g., "+2 today").
    let trendLabel: String?

    // MARK: Initialization

    init(
        icon: String,
        iconColor: Color,
        title: String,
        value: String,
        trend: MetricTrend = .neutral,
        trendLabel: String? = nil
    ) {
        self.icon = icon
        self.iconColor = iconColor
        self.title = title
        self.value = value
        self.trend = trend
        self.trendLabel = trendLabel
    }

    // MARK: Body

    var body: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xs) {
            // Icon
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(iconColor)
                .frame(width: 28, height: 28)
                .background(iconColor.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.xs))

            // Value
            Text(value)
                .font(AlgoTypography.metricMedium)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            // Title
            Text(title)
                .font(AlgoTypography.caption)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)
                .lineLimit(1)

            // Trend indicator
            if trend != .neutral || trendLabel != nil {
                HStack(spacing: AlgoTheme.Spacing.xxxs) {
                    if trend != .neutral {
                        Image(systemName: trendArrowName)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(trendColor)
                    }

                    if let trendLabel {
                        Text(trendLabel)
                            .font(AlgoTypography.labelSmall)
                            .foregroundStyle(trendColor)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .algoShadow(AlgoTheme.Shadow.sm)
    }

    // MARK: Trend Helpers

    private var trendArrowName: String {
        switch trend {
        case .up:      return "arrow.up.right"
        case .down:    return "arrow.down.right"
        case .neutral: return "minus"
        }
    }

    private var trendColor: Color {
        switch trend {
        case .up:      return AlgoTheme.Colors.success
        case .down:    return AlgoTheme.Colors.error
        case .neutral: return AlgoTheme.Colors.textSecondary
        }
    }
}

// MARK: - Shimmer Placeholder

extension MetricTile {

    /// A shimmer placeholder matching the MetricTile layout.
    /// Used during initial loading.
    static var shimmerPlaceholder: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xs) {
            ShimmerPlaceholder(width: 28, height: 28)
            ShimmerPlaceholder(width: 60, height: 24)
            ShimmerPlaceholder(width: 80, height: 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AlgoTheme.Spacing.sm)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .algoShadow(AlgoTheme.Shadow.sm)
    }
}

// MARK: - Preview

#Preview("Metric Tiles") {
    LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 12) {
        MetricTile(
            icon: "person.2.fill",
            iconColor: .blue,
            title: "Total Leads",
            value: "47",
            trend: .up,
            trendLabel: "+5"
        )

        MetricTile(
            icon: "flame.fill",
            iconColor: .orange,
            title: "Hot Leads",
            value: "5",
            trend: .up,
            trendLabel: "+2"
        )

        MetricTile(
            icon: "megaphone.fill",
            iconColor: .purple,
            title: "Active Campaigns",
            value: "12",
            trend: .neutral
        )

        MetricTile(
            icon: "dollarsign.circle.fill",
            iconColor: .green,
            title: "Revenue Today",
            value: "$12,450"
        )

        MetricTile.shimmerPlaceholder
        MetricTile.shimmerPlaceholder
    }
    .padding()
}
