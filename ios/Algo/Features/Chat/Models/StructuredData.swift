// StructuredData.swift
// Algo
//
// Structured data model for rich content returned by the assistant,
// such as performance summaries, charts, and action confirmation details.

import Foundation

// MARK: - StructuredData

struct StructuredData: Codable, Sendable, Equatable {

    /// The type of structured content (e.g. "performance_summary", "action_confirmation", "action_result").
    let type: String

    /// Array of metric dictionaries for data visualization (charts, tables).
    /// Each entry is a flexible key-value map to accommodate varying metric shapes.
    let metrics: [[String: JSONValue]]?

    /// Suggested chart visualization type (e.g. "bar", "line", "pie").
    let chartType: String?

    /// Time range label for the data (e.g. "today", "last_7_days").
    let timeRange: String?

    /// The action being confirmed or executed (e.g. "PAUSE_CAMPAIGN").
    let action: String?

    /// The status of a completed action (e.g. "success", "failed").
    let status: String?

    /// Target entity details for action confirmations.
    let target: [String: JSONValue]?

    /// Campaign ID for action results referencing a specific campaign.
    let campaignId: String?

    enum CodingKeys: String, CodingKey {
        case type
        case metrics
        case chartType = "chart_type"
        case timeRange = "time_range"
        case action
        case status
        case target
        case campaignId = "campaign_id"
    }
}

// MARK: - StructuredData Type Constants

extension StructuredData {

    /// Known structured data types returned by the backend.
    enum DataType {
        static let performanceSummary = "performance_summary"
        static let actionConfirmation = "action_confirmation"
        static let actionResult = "action_result"
        static let leadList = "lead_list"
        static let campaignList = "campaign_list"
        static let analyticsReport = "analytics_report"
    }

    /// Whether this structured data represents a chart-renderable dataset.
    var isChartData: Bool {
        chartType != nil && metrics != nil
    }

    /// Whether this structured data represents an action requiring user confirmation.
    var isActionConfirmation: Bool {
        type == DataType.actionConfirmation
    }

    /// Whether this structured data represents the result of a completed action.
    var isActionResult: Bool {
        type == DataType.actionResult
    }

    /// The chart type as a typed enum, if recognized.
    var chartTypeEnum: ChartType? {
        guard let chartType else { return nil }
        return ChartType(rawValue: chartType)
    }

    /// Extracts a flat list of metric display entries from the raw JSON metrics.
    var metricEntries: [MetricEntry] {
        guard let metrics else { return [] }
        return metrics.enumerated().map { index, dict in
            MetricEntry(index: index, values: dict)
        }
    }
}

// MARK: - ChartType

enum ChartType: String, Codable, Sendable {
    case bar
    case line
    case pie
}

// MARK: - MetricEntry

/// A parsed metric row extracted from StructuredData's `metrics` array.
/// Provides convenient typed accessors for common fields while preserving
/// access to the underlying raw values.
struct MetricEntry: Identifiable, Sendable, Equatable {
    let id: String
    let values: [String: JSONValue]

    init(index: Int, values: [String: JSONValue]) {
        // Use platform or label as the identifier if available; otherwise use index.
        if let platform = values["platform"]?.stringValue {
            self.id = platform
        } else if let label = values["label"]?.stringValue {
            self.id = label
        } else {
            self.id = "metric_\(index)"
        }
        self.values = values
    }

    var platform: String? { values["platform"]?.stringValue }
    var label: String? { values["label"]?.stringValue }
    var likes: Int? { values["likes"]?.intValue }
    var comments: Int? { values["comments"]?.intValue }
    var shares: Int? { values["shares"]?.intValue }
    var impressions: Int? { values["impressions"]?.intValue }
    var clicks: Int? { values["clicks"]?.intValue }
    var conversions: Int? { values["conversions"]?.intValue }
    var value: Double? { values["value"]?.doubleValue }

    /// Returns the total engagement count across all numeric metric fields.
    var totalEngagement: Int {
        (likes ?? 0) + (comments ?? 0) + (shares ?? 0)
    }

    /// Returns all non-nil key-value pairs suitable for display.
    var displayPairs: [(key: String, value: String)] {
        var pairs: [(String, String)] = []
        for (key, jsonValue) in values.sorted(by: { $0.key < $1.key }) {
            switch jsonValue {
            case .string(let s): pairs.append((key.capitalized, s))
            case .int(let i): pairs.append((key.capitalized, formatNumber(i)))
            case .double(let d): pairs.append((key.capitalized, formatDecimal(d)))
            case .bool(let b): pairs.append((key.capitalized, b ? "Yes" : "No"))
            default: break
            }
        }
        return pairs
    }

    private func formatNumber(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func formatDecimal(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
