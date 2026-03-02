// SuggestedAction.swift
// Algo
//
// Suggested action model for quick-action buttons displayed below assistant messages.
// Also includes the JSONValue enum for handling mixed-type JSON values in params.

import Foundation

// MARK: - SuggestedAction

struct SuggestedAction: Codable, Identifiable, Sendable, Equatable, Hashable {

    var id: String { "\(action)_\(label)" }

    let label: String
    let action: String
    let params: [String: JSONValue]?

    /// Returns a human-readable message that represents this action for sending to the chat.
    var messageText: String {
        label
    }
}

// MARK: - JSONValue

/// A type-erased JSON value that handles mixed-type dictionaries and arrays
/// commonly returned by the Algo backend in `params` and `structured_data` fields.
enum JSONValue: Sendable, Equatable, Hashable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null
}

// MARK: - JSONValue + Codable

extension JSONValue: Codable {

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
            return
        }

        // Try bool before int/double to avoid 0/1 being decoded as numbers.
        if let boolValue = try? container.decode(Bool.self) {
            self = .bool(boolValue)
            return
        }

        if let intValue = try? container.decode(Int.self) {
            self = .int(intValue)
            return
        }

        if let doubleValue = try? container.decode(Double.self) {
            self = .double(doubleValue)
            return
        }

        if let stringValue = try? container.decode(String.self) {
            self = .string(stringValue)
            return
        }

        if let objectValue = try? container.decode([String: JSONValue].self) {
            self = .object(objectValue)
            return
        }

        if let arrayValue = try? container.decode([JSONValue].self) {
            self = .array(arrayValue)
            return
        }

        throw DecodingError.typeMismatch(
            JSONValue.self,
            .init(codingPath: decoder.codingPath, debugDescription: "Unsupported JSON value type")
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .string(let value):
            try container.encode(value)
        case .int(let value):
            try container.encode(value)
        case .double(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }
}

// MARK: - JSONValue Convenience Accessors

extension JSONValue {

    /// Returns the underlying string value, or nil if this is not a `.string`.
    var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    /// Returns the underlying integer value, or nil if this is not an `.int`.
    var intValue: Int? {
        if case .int(let value) = self { return value }
        return nil
    }

    /// Returns the underlying double value, coercing from int if needed.
    var doubleValue: Double? {
        switch self {
        case .double(let value): return value
        case .int(let value): return Double(value)
        default: return nil
        }
    }

    /// Returns the underlying boolean value, or nil if this is not a `.bool`.
    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    /// Returns the underlying dictionary, or nil if this is not an `.object`.
    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    /// Returns the underlying array, or nil if this is not an `.array`.
    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    /// Whether this value is `.null`.
    var isNull: Bool {
        if case .null = self { return true }
        return false
    }
}

// MARK: - JSONValue ExpressibleByLiteral Conformances

extension JSONValue: ExpressibleByStringLiteral {
    init(stringLiteral value: String) {
        self = .string(value)
    }
}

extension JSONValue: ExpressibleByIntegerLiteral {
    init(integerLiteral value: Int) {
        self = .int(value)
    }
}

extension JSONValue: ExpressibleByFloatLiteral {
    init(floatLiteral value: Double) {
        self = .double(value)
    }
}

extension JSONValue: ExpressibleByBooleanLiteral {
    init(booleanLiteral value: Bool) {
        self = .bool(value)
    }
}

extension JSONValue: ExpressibleByNilLiteral {
    init(nilLiteral: ()) {
        self = .null
    }
}

extension JSONValue: ExpressibleByDictionaryLiteral {
    init(dictionaryLiteral elements: (String, JSONValue)...) {
        self = .object(Dictionary(uniqueKeysWithValues: elements))
    }
}

extension JSONValue: ExpressibleByArrayLiteral {
    init(arrayLiteral elements: JSONValue...) {
        self = .array(elements)
    }
}
