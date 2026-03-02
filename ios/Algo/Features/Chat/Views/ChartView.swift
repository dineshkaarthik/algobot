// ChartView.swift
// Algo
//
// Chart visualization component for rendering bar, line, and pie charts
// from StructuredData metrics. Uses Swift Charts framework (iOS 16+).
// Falls back to a simple rectangle-based bar representation if needed.

import SwiftUI
import Charts

// MARK: - AlgoChartView

/// Renders chart visualizations from structured metric data.
///
/// Supports bar, line, and pie chart types read from `StructuredData.chartType`.
/// Uses the Swift Charts framework for clean, animated chart rendering.
struct AlgoChartView: View {

    // MARK: - Properties

    let structuredData: StructuredData

    @State private var hasAppeared = false

    // MARK: - Body

    var body: some View {
        Group {
            switch structuredData.chartTypeEnum {
            case .bar:
                barChart
            case .line:
                lineChart
            case .pie:
                pieChart
            case .none:
                barChart // Default to bar chart
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.6).delay(0.1)) {
                hasAppeared = true
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(chartAccessibilityLabel)
    }

    // MARK: - Chart Data

    /// Extracts chart data points from the structured data's metric entries.
    private var chartDataPoints: [ChartDataPoint] {
        structuredData.metricEntries.map { entry in
            ChartDataPoint(
                label: entry.platform?.capitalized ?? entry.label ?? entry.id,
                value: Double(entry.totalEngagement),
                platform: entry.platform
            )
        }
    }

    // MARK: - Bar Chart

    private var barChart: some View {
        Chart(chartDataPoints) { point in
            BarMark(
                x: .value("Category", point.label),
                y: .value("Value", hasAppeared ? point.value : 0)
            )
            .foregroundStyle(barColor(for: point.platform))
            .cornerRadius(AlgoTheme.CornerRadius.xs)
        }
        .chartXAxis {
            AxisMarks { _ in
                AxisValueLabel()
                    .font(AlgoTypography.caption)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { _ in
                AxisValueLabel()
                    .font(AlgoTypography.caption)
                AxisGridLine()
                    .foregroundStyle(AlgoTheme.Colors.divider)
            }
        }
    }

    // MARK: - Line Chart

    private var lineChart: some View {
        Chart(chartDataPoints) { point in
            LineMark(
                x: .value("Category", point.label),
                y: .value("Value", hasAppeared ? point.value : 0)
            )
            .foregroundStyle(AlgoTheme.Colors.primary)
            .interpolationMethod(.catmullRom)

            PointMark(
                x: .value("Category", point.label),
                y: .value("Value", hasAppeared ? point.value : 0)
            )
            .foregroundStyle(AlgoTheme.Colors.primary)
            .symbolSize(30)

            AreaMark(
                x: .value("Category", point.label),
                y: .value("Value", hasAppeared ? point.value : 0)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [
                        AlgoTheme.Colors.primary.opacity(0.2),
                        AlgoTheme.Colors.primary.opacity(0.02)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .interpolationMethod(.catmullRom)
        }
        .chartXAxis {
            AxisMarks { _ in
                AxisValueLabel()
                    .font(AlgoTypography.caption)
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { _ in
                AxisValueLabel()
                    .font(AlgoTypography.caption)
                AxisGridLine()
                    .foregroundStyle(AlgoTheme.Colors.divider)
            }
        }
    }

    // MARK: - Pie Chart

    private var pieChart: some View {
        let total = chartDataPoints.reduce(0) { $0 + $1.value }

        return Chart(chartDataPoints) { point in
            SectorMark(
                angle: .value("Value", hasAppeared ? point.value : 0),
                innerRadius: .ratio(0.5),
                angularInset: 1.5
            )
            .foregroundStyle(barColor(for: point.platform))
            .cornerRadius(AlgoTheme.CornerRadius.xs)
            .annotation(position: .overlay) {
                if point.value / max(total, 1) > 0.1 {
                    Text(point.label.prefix(3).uppercased())
                        .font(AlgoTypography.captionBold)
                        .foregroundStyle(.white)
                }
            }
        }
    }

    // MARK: - Color Mapping

    /// Returns a chart color for a given platform name.
    private func barColor(for platform: String?) -> Color {
        guard let platform = platform?.lowercased() else {
            return AlgoTheme.Colors.primary
        }

        switch platform {
        case "instagram":
            return Color(red: 0.83, green: 0.18, blue: 0.42)
        case "facebook":
            return Color(red: 0.23, green: 0.35, blue: 0.60)
        case "twitter", "x":
            return Color(red: 0.11, green: 0.63, blue: 0.95)
        case "linkedin":
            return Color(red: 0.0, green: 0.47, blue: 0.71)
        case "whatsapp":
            return Color(red: 0.15, green: 0.68, blue: 0.38)
        default:
            return AlgoTheme.Colors.primary
        }
    }

    // MARK: - Accessibility

    private var chartAccessibilityLabel: String {
        let entries = chartDataPoints.map { "\($0.label): \(Int($0.value))" }
        return "Chart showing: " + entries.joined(separator: ", ")
    }
}

// MARK: - ChartDataPoint

/// A single data point for chart rendering.
struct ChartDataPoint: Identifiable {
    let id = UUID()
    let label: String
    let value: Double
    let platform: String?
}

// MARK: - Preview

#Preview("Chart Views") {
    let sampleData = StructuredData(
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

    ScrollView {
        VStack(spacing: 30) {
            Text("Bar Chart")
                .font(.headline)
            AlgoChartView(structuredData: sampleData)
                .frame(height: 200)

            Text("Line Chart")
                .font(.headline)
            AlgoChartView(structuredData: StructuredData(
                type: StructuredData.DataType.performanceSummary,
                metrics: sampleData.metrics,
                chartType: "line",
                timeRange: "today",
                action: nil, status: nil, target: nil, campaignId: nil
            ))
            .frame(height: 200)

            Text("Pie Chart")
                .font(.headline)
            AlgoChartView(structuredData: StructuredData(
                type: StructuredData.DataType.performanceSummary,
                metrics: sampleData.metrics,
                chartType: "pie",
                timeRange: "today",
                action: nil, status: nil, target: nil, campaignId: nil
            ))
            .frame(height: 200)
        }
        .padding()
    }
}
