// DeepLinkHandler.swift
// Algo
//
// Handles deep link parsing and routing from push notifications,
// universal links, and custom URL schemes.

import Foundation

// MARK: - DeepLinkHandler

/// Parses incoming URLs and converts them to app navigation actions.
///
/// Supports:
/// - Push notification action URLs (e.g., "/leads/lead_sarah_001")
/// - Universal links (e.g., "https://algo.algonit.com/leads/lead_001")
/// - Custom URL scheme (e.g., "algo://leads/lead_001")
enum DeepLinkHandler {

    // MARK: URL Scheme

    /// The custom URL scheme for the Algo app.
    static let customScheme = "algo"

    /// The universal link host.
    static let universalLinkHost = "algo.algonit.com"

    // MARK: Parsed Result

    /// Represents a parsed deep link destination.
    enum Destination: Equatable {
        case chat
        case conversation(id: String)
        case dashboard
        case notifications
        case settings
        case lead(id: String)
        case campaign(id: String)

        /// Converts this destination to an `AppRoute` for the router.
        var appRoute: AppRoute? {
            switch self {
            case .conversation(let id):
                return .conversation(id: id)
            case .lead(let id):
                return .leadDetail(id: id)
            case .campaign(let id):
                return .campaignDetail(id: id)
            default:
                return nil
            }
        }

        /// Returns the `AppTab` this destination belongs to.
        var tab: AppTab {
            switch self {
            case .chat, .conversation:
                return .chat
            case .dashboard:
                return .dashboard
            case .notifications:
                return .notifications
            case .settings:
                return .settings
            case .lead, .campaign:
                return .chat
            }
        }
    }

    // MARK: Parsing

    /// Parses a URL into a navigation destination.
    /// - Parameter url: The incoming URL to parse.
    /// - Returns: The parsed destination, or `nil` if the URL is not recognized.
    static func parse(url: URL) -> Destination? {
        // Handle custom URL scheme: algo://path
        if url.scheme == customScheme {
            return parsePath(url.host.map { "/\($0)" + url.path } ?? url.path)
        }

        // Handle universal links: https://algo.algonit.com/path
        if url.host == universalLinkHost {
            return parsePath(url.path)
        }

        // Handle bare paths (from notification payloads): /leads/lead_001
        if url.scheme == nil || url.scheme?.isEmpty == true {
            return parsePath(url.absoluteString)
        }

        return nil
    }

    /// Parses a notification payload action URL string.
    /// - Parameter actionUrl: The action URL from the notification payload.
    /// - Returns: The parsed destination, or `nil` if not recognized.
    static func parseNotificationActionUrl(_ actionUrl: String) -> Destination? {
        return parsePath(actionUrl)
    }

    // MARK: Private Parsing

    /// Parses a URL path into a destination.
    private static func parsePath(_ path: String) -> Destination? {
        // Remove leading slash and split into components
        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let components = trimmed.split(separator: "/").map(String.init)

        guard let first = components.first else { return nil }

        switch first {
        case "chat", "conversations":
            if components.count > 1 {
                return .conversation(id: components[1])
            }
            return .chat

        case "dashboard":
            return .dashboard

        case "notifications":
            return .notifications

        case "settings":
            return .settings

        case "leads":
            if components.count > 1 {
                return .lead(id: components[1])
            }
            return .chat

        case "campaigns":
            if components.count > 1 {
                return .campaign(id: components[1])
            }
            return .dashboard

        default:
            return nil
        }
    }

    // MARK: Routing

    /// Routes a parsed destination to the app router.
    /// - Parameters:
    ///   - destination: The parsed deep link destination.
    ///   - router: The app router to navigate with.
    static func route(destination: Destination, using router: AppRouter) {
        router.selectedTab = destination.tab

        if let route = destination.appRoute {
            router.navigate(to: route)
        }
    }

    /// Parses a URL and routes it through the app router in one step.
    /// - Parameters:
    ///   - url: The incoming URL.
    ///   - router: The app router to navigate with.
    /// - Returns: `true` if the URL was successfully handled.
    @discardableResult
    static func handleURL(_ url: URL, using router: AppRouter) -> Bool {
        guard let destination = parse(url: url) else { return false }
        route(destination: destination, using: router)
        return true
    }

    /// Handles a notification action URL string by routing through the app router.
    /// - Parameters:
    ///   - actionUrl: The action URL from the notification payload.
    ///   - router: The app router to navigate with.
    @discardableResult
    static func handleNotificationAction(_ actionUrl: String, using router: AppRouter) -> Bool {
        guard let destination = parseNotificationActionUrl(actionUrl) else { return false }
        route(destination: destination, using: router)
        return true
    }
}
