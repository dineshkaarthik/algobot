// AppConfiguration.swift
// Algo
//
// Environment configuration for the Algo app.
// Provides base URLs, API keys, and build metadata
// based on the active build configuration (DEBUG vs RELEASE).

import Foundation

/// Centralized application configuration that adapts to the current build environment.
///
/// Usage:
/// ```swift
/// let url = AppConfiguration.baseURL
/// let wsURL = AppConfiguration.webSocketURL
/// ```
enum AppConfiguration {

    // MARK: - Environment

    /// The current build environment derived from compiler flags.
    enum Environment: String {
        case debug
        case release

        var displayName: String {
            switch self {
            case .debug: return "Development"
            case .release: return "Production"
            }
        }
    }

    /// The active environment for this build.
    static var current: Environment {
        #if DEBUG
        return .debug
        #else
        return .release
        #endif
    }

    // MARK: - API URLs

    /// The base URL for all REST API requests.
    static var baseURL: URL {
        switch current {
        case .debug:
            return URL(string: "https://api-staging.algo.algonit.com/v1")!
        case .release:
            return URL(string: "https://api.algo.algonit.com/v1")!
        }
    }

    /// The WebSocket URL for real-time communication.
    static var webSocketURL: URL {
        switch current {
        case .debug:
            return URL(string: "wss://api-staging.algo.algonit.com/v1/ws")!
        case .release:
            return URL(string: "wss://api.algo.algonit.com/v1/ws")!
        }
    }

    // MARK: - Timeouts

    /// Default timeout interval for standard API requests, in seconds.
    static let requestTimeout: TimeInterval = 30

    /// Timeout interval for file upload requests (audio, images), in seconds.
    static let uploadTimeout: TimeInterval = 120

    /// Timeout interval for WebSocket ping/pong, in seconds.
    static let webSocketPingInterval: TimeInterval = 25

    // MARK: - Rate Limits

    /// Maximum audio recording duration in seconds.
    static let maxRecordingDuration: TimeInterval = 60

    // MARK: - App Metadata

    /// The marketing version string (e.g., "1.0.0") from Info.plist.
    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
    }

    /// The build number string (e.g., "42") from Info.plist.
    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
    }

    /// Combined version string for display (e.g., "1.0.0 (42)").
    static var fullVersion: String {
        "\(appVersion) (\(buildNumber))"
    }

    /// The OS version string (e.g., "iOS 17.4").
    static var osVersion: String {
        "iOS \(ProcessInfo.processInfo.operatingSystemVersion.majorVersion).\(ProcessInfo.processInfo.operatingSystemVersion.minorVersion)"
    }

    /// A unique device identifier persisted across launches via UserDefaults.
    /// Falls back to UUID if identifierForVendor is unavailable.
    static var deviceID: String {
        let key = "algo_device_id"
        if let existing = UserDefaults.standard.string(forKey: key) {
            return existing
        }
        let id = "ios_\(UUID().uuidString.lowercased())"
        UserDefaults.standard.set(id, forKey: key)
        return id
    }

    // MARK: - Logging

    /// Whether verbose network logging is enabled.
    static var isLoggingEnabled: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
}
