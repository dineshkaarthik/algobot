// Date+Extensions.swift
// Algo
//
// Date formatting helpers for displaying timestamps throughout the app.
// Provides relative time strings, formatted time/date strings, and
// ISO 8601 parsing for API responses.

import Foundation

extension Date {

    // MARK: - Relative Formatting

    /// Returns a human-readable relative time string.
    ///
    /// Examples:
    /// - "Just now" (< 1 minute)
    /// - "5 minutes ago"
    /// - "2 hours ago"
    /// - "Yesterday"
    /// - "3 days ago"
    /// - "Mar 15" (> 7 days, same year)
    /// - "Mar 15, 2025" (different year)
    var relativeFormat: String {
        let now = Date()
        let interval = now.timeIntervalSince(self)

        // Future dates
        if interval < 0 {
            return Self.shortDateFormatter.string(from: self)
        }

        // Less than 1 minute
        if interval < 60 {
            return "Just now"
        }

        // Less than 1 hour
        if interval < 3600 {
            let minutes = Int(interval / 60)
            return minutes == 1 ? "1 minute ago" : "\(minutes) minutes ago"
        }

        // Less than 24 hours
        if interval < 86400 {
            let hours = Int(interval / 3600)
            return hours == 1 ? "1 hour ago" : "\(hours) hours ago"
        }

        // Yesterday
        if Calendar.current.isDateInYesterday(self) {
            return "Yesterday"
        }

        // Less than 7 days
        if interval < 604800 {
            let days = Int(interval / 86400)
            return days == 1 ? "1 day ago" : "\(days) days ago"
        }

        // Same year
        if Calendar.current.component(.year, from: self) == Calendar.current.component(.year, from: now) {
            return Self.shortDateFormatter.string(from: self)
        }

        // Different year
        return Self.fullDateFormatter.string(from: self)
    }

    /// Returns a short relative time string using the system formatter (e.g., "2m ago", "3h ago").
    var relativeShortString: String {
        Self.relativeFormatter.localizedString(for: self, relativeTo: .now)
    }

    // MARK: - Time String

    /// Returns a formatted time string (e.g., "3:45 PM").
    var timeString: String {
        Self.timeFormatter.string(from: self)
    }

    /// Returns a formatted date string (e.g., "Mar 15, 2026").
    var dateString: String {
        Self.fullDateFormatter.string(from: self)
    }

    /// Returns a short date string (e.g., "Mar 1, 2026").
    var shortDateString: String {
        Self.fullDateFormatter.string(from: self)
    }

    /// Returns a short date and time string (e.g., "Mar 15, 3:45 PM").
    var dateTimeString: String {
        Self.dateTimeFormatter.string(from: self)
    }

    /// Returns a formatted date+time string (e.g., "Mar 1, 3:45 PM").
    var shortDateTimeString: String {
        Self.dateTimeFormatter.string(from: self)
    }

    // MARK: - ISO 8601

    /// Parses an ISO 8601 date string (e.g., "2026-03-01T15:30:00Z").
    ///
    /// Supports both formats with and without fractional seconds.
    ///
    /// - Parameter string: The ISO 8601 formatted date string.
    /// - Returns: The parsed `Date`, or `nil` if the string is invalid.
    static func fromISO8601(_ string: String) -> Date? {
        // Try standard ISO 8601 first
        if let date = iso8601Formatter.date(from: string) {
            return date
        }
        // Try with fractional seconds
        if let date = iso8601FractionalFormatter.date(from: string) {
            return date
        }
        return nil
    }

    /// Returns this date formatted as an ISO 8601 string.
    var iso8601String: String {
        Self.iso8601Formatter.string(from: self)
    }

    // MARK: - Convenience

    /// Whether this date is today.
    var isToday: Bool {
        Calendar.current.isDateInToday(self)
    }

    /// Whether this date is yesterday.
    var isYesterday: Bool {
        Calendar.current.isDateInYesterday(self)
    }

    /// Whether this date is within the current week.
    var isThisWeek: Bool {
        Calendar.current.isDate(self, equalTo: Date(), toGranularity: .weekOfYear)
    }

    // MARK: - Formatters (Cached as Static Properties)

    /// Relative date time formatter with abbreviated units.
    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        formatter.dateTimeStyle = .named
        return formatter
    }()

    /// Time-only formatter: "3:45 PM"
    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    /// Short date formatter: "Mar 15"
    private static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    /// Full date formatter: "Mar 15, 2026"
    private static let fullDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Date and time formatter: "Mar 15, 3:45 PM"
    private static let dateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    /// ISO 8601 formatter without fractional seconds.
    private static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// ISO 8601 formatter with fractional seconds.
    private static let iso8601FractionalFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
