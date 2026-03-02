// String+Extensions.swift
// Algo
//
// String utility extensions for validation, formatting, and manipulation.
// Used throughout the app for input validation, display formatting,
// and text processing.

import Foundation

extension String {

    // MARK: - Validation

    /// Whether this string is a valid email address.
    ///
    /// Uses a standard email regex pattern that covers most common formats.
    /// Not intended to be RFC 5322 compliant, but sufficient for UI validation.
    var isValidEmail: Bool {
        let pattern = #"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return range(of: pattern, options: .regularExpression) != nil
    }

    /// Whether this string meets the minimum password requirements.
    ///
    /// Requirements:
    /// - At least 8 characters
    /// - At least one uppercase letter
    /// - At least one digit
    var isValidPassword: Bool {
        guard count >= 8 else { return false }

        let hasUppercase = range(of: "[A-Z]", options: .regularExpression) != nil
        let hasDigit = range(of: "[0-9]", options: .regularExpression) != nil

        return hasUppercase && hasDigit
    }

    /// Returns a list of password validation failures, or an empty array if valid.
    ///
    /// Useful for showing specific validation messages to the user.
    var passwordValidationErrors: [String] {
        var errors: [String] = []

        if count < 8 {
            errors.append("Must be at least 8 characters")
        }
        if range(of: "[A-Z]", options: .regularExpression) == nil {
            errors.append("Must contain at least one uppercase letter")
        }
        if range(of: "[0-9]", options: .regularExpression) == nil {
            errors.append("Must contain at least one number")
        }

        return errors
    }

    // MARK: - Formatting

    /// Returns a truncated version of this string with a trailing ellipsis.
    ///
    /// If the string is shorter than `maxLength`, it is returned unchanged.
    ///
    /// - Parameter maxLength: The maximum number of characters before truncation.
    /// - Returns: The original string or a truncated version with "..." appended.
    func truncated(to maxLength: Int) -> String {
        guard count > maxLength, maxLength > 3 else { return self }
        return String(prefix(maxLength - 3)) + "..."
    }

    /// Returns this string with leading and trailing whitespace and newlines removed.
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Whether this string is empty or contains only whitespace characters.
    var isBlank: Bool {
        trimmed.isEmpty
    }

    // MARK: - Initials

    /// Returns the initials from this string (e.g., "John Doe" -> "JD").
    ///
    /// Takes the first letter of each word, up to 2 initials.
    var initials: String {
        let words = split(separator: " ")
        let initials = words.prefix(2).compactMap { $0.first }
        return String(initials).uppercased()
    }

    // MARK: - Number Formatting

    /// Attempts to format this string as a compact number (e.g., "12345" -> "12.3K").
    ///
    /// Returns the original string if it cannot be parsed as a number.
    var compactNumber: String {
        guard let number = Double(self) else { return self }
        return number.compactFormatted
    }
}

// MARK: - Optional String

extension Optional where Wrapped == String {

    /// Whether the optional string is `nil` or blank.
    var isNilOrBlank: Bool {
        self?.isBlank ?? true
    }
}

// MARK: - Double Compact Formatting

extension Double {

    /// Formats a number in compact form (e.g., 12345 -> "12.3K", 1234567 -> "1.2M").
    var compactFormatted: String {
        let absValue = abs(self)
        let sign = self < 0 ? "-" : ""

        switch absValue {
        case 1_000_000_000...:
            return "\(sign)\(String(format: "%.1f", absValue / 1_000_000_000))B"
        case 1_000_000...:
            return "\(sign)\(String(format: "%.1f", absValue / 1_000_000))M"
        case 1_000...:
            return "\(sign)\(String(format: "%.1f", absValue / 1_000))K"
        default:
            return "\(sign)\(String(format: "%.0f", absValue))"
        }
    }
}
