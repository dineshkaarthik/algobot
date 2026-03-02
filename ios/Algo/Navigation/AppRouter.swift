// AppRouter.swift
// Algo
//
// Navigation coordinator managing tab selection and programmatic navigation.
// Serves as the single source of truth for app-wide navigation state.

import SwiftUI

// MARK: - AppTab

/// Represents the available tabs in the main tab bar.
enum AppTab: String, CaseIterable, Identifiable {
    case chat = "Chat"
    case dashboard = "Dashboard"
    case growth = "Growth"
    case notifications = "Notifications"
    case settings = "Settings"

    var id: String { rawValue }

    /// SF Symbol name for the tab icon.
    var icon: String {
        switch self {
        case .chat:          return "bubble.left.and.bubble.right"
        case .dashboard:     return "square.grid.2x2"
        case .growth:        return "chart.line.uptrend.xyaxis"
        case .notifications: return "bell"
        case .settings:      return "gearshape"
        }
    }

    /// SF Symbol name for the selected tab icon.
    var selectedIcon: String {
        switch self {
        case .chat:          return "bubble.left.and.bubble.right.fill"
        case .dashboard:     return "square.grid.2x2.fill"
        case .growth:        return "chart.line.uptrend.xyaxis"
        case .notifications: return "bell.fill"
        case .settings:      return "gearshape.fill"
        }
    }
}

// MARK: - AppRoute

/// Represents specific navigation destinations within the app.
enum AppRoute: Hashable {
    /// Navigate to a specific chat conversation.
    case conversation(id: String)
    /// Navigate to a specific lead detail.
    case leadDetail(id: String)
    /// Navigate to a specific campaign detail.
    case campaignDetail(id: String)
    /// Navigate to notification preferences.
    case notificationPreferences
}

// MARK: - AppRouter

/// Centralized navigation coordinator for the Algo app.
///
/// Manages:
/// - Tab selection state
/// - Navigation path for programmatic navigation within tabs
/// - Deep link handling
///
/// Injected as an `@EnvironmentObject` throughout the app.
final class AppRouter: ObservableObject {

    // MARK: Published State

    /// The currently selected tab.
    @Published var selectedTab: AppTab = .chat

    /// Navigation path for the chat tab.
    @Published var chatNavigationPath = NavigationPath()

    /// Navigation path for the dashboard tab.
    @Published var dashboardNavigationPath = NavigationPath()

    /// Navigation path for the growth tab.
    @Published var growthNavigationPath = NavigationPath()

    /// Navigation path for the notifications tab.
    @Published var notificationsNavigationPath = NavigationPath()

    /// Navigation path for the settings tab.
    @Published var settingsNavigationPath = NavigationPath()

    // MARK: Navigation Methods

    /// Navigates to a specific route, switching tabs if necessary.
    /// - Parameter route: The destination route.
    func navigate(to route: AppRoute) {
        switch route {
        case .conversation:
            selectedTab = .chat
            chatNavigationPath.append(route)

        case .leadDetail:
            selectedTab = .chat
            chatNavigationPath.append(route)

        case .campaignDetail:
            selectedTab = .chat
            chatNavigationPath.append(route)

        case .notificationPreferences:
            selectedTab = .settings
            settingsNavigationPath.append(route)
        }
    }

    /// Handles a deep link URL string by parsing it and navigating to the correct screen.
    /// - Parameter url: The deep link URL (e.g., "/leads/lead_sarah_001").
    func handleDeepLink(url: String) {
        let components = url.split(separator: "/").map(String.init)

        guard !components.isEmpty else { return }

        switch components.first {
        case "leads":
            if components.count > 1 {
                navigate(to: .leadDetail(id: components[1]))
            }

        case "campaigns":
            if components.count > 1 {
                navigate(to: .campaignDetail(id: components[1]))
            }

        case "conversations", "chat":
            if components.count > 1 {
                navigate(to: .conversation(id: components[1]))
            } else {
                selectedTab = .chat
            }

        case "growth", "recommendations":
            selectedTab = .growth

        case "notifications":
            selectedTab = .notifications

        case "settings":
            selectedTab = .settings

        default:
            break
        }
    }

    /// Resets navigation state for all tabs.
    func resetAllNavigation() {
        chatNavigationPath = NavigationPath()
        dashboardNavigationPath = NavigationPath()
        growthNavigationPath = NavigationPath()
        notificationsNavigationPath = NavigationPath()
        settingsNavigationPath = NavigationPath()
        selectedTab = .chat
    }

    /// Resets the navigation path for the currently selected tab.
    func popToRoot() {
        switch selectedTab {
        case .chat:
            chatNavigationPath = NavigationPath()
        case .dashboard:
            dashboardNavigationPath = NavigationPath()
        case .growth:
            growthNavigationPath = NavigationPath()
        case .notifications:
            notificationsNavigationPath = NavigationPath()
        case .settings:
            settingsNavigationPath = NavigationPath()
        }
    }
}
