// MainTabView.swift
// Algo
//
// Main tab bar view with 5 tabs: Chat, Dashboard, Growth, Notifications, Settings.
// Displays badge count on the Notifications tab for unread items.

import SwiftUI

// MARK: - MainTabView

/// The root tab bar view shown after successful authentication.
///
/// Tabs:
/// 1. **Chat** - AI conversation interface
/// 2. **Dashboard** - Business metrics and alerts
/// 3. **Growth** - AI growth recommendations
/// 4. **Notifications** - Alert notifications list
/// 5. **Settings** - Account and app settings
struct MainTabView: View {

    // MARK: Properties

    @EnvironmentObject private var router: AppRouter
    @EnvironmentObject private var authViewModel: AuthViewModel

    /// Service dependencies. In production, these would be injected from a DI container.
    private let dashboardService: DashboardServiceProtocol
    private let growthService: GrowthServiceProtocol
    private let notificationService: NotificationServiceProtocol
    private let settingsViewModel: SettingsViewModel

    /// Unread notification count for the tab badge.
    @State private var unreadCount: Int = 0

    // MARK: Initialization

    /// Creates a new `MainTabView` with injected service dependencies.
    init(
        dashboardService: DashboardServiceProtocol,
        growthService: GrowthServiceProtocol,
        notificationService: NotificationServiceProtocol,
        settingsViewModel: SettingsViewModel
    ) {
        self.dashboardService = dashboardService
        self.growthService = growthService
        self.notificationService = notificationService
        self.settingsViewModel = settingsViewModel
    }

    // MARK: Body

    var body: some View {
        TabView(selection: $router.selectedTab) {
            // Chat Tab
            chatTab

            // Dashboard Tab
            dashboardTab

            // Growth Tab
            growthTab

            // Notifications Tab
            notificationsTab

            // Settings Tab
            settingsTab
        }
        .tint(AlgoTheme.Colors.primary)
        .onOpenURL { url in
            DeepLinkHandler.handleURL(url, using: router)
        }
    }

    // MARK: Chat Tab

    private var chatTab: some View {
        // Placeholder for Chat feature (implemented separately)
        NavigationStack(path: $router.chatNavigationPath) {
            VStack {
                Text("Chat with Algo")
                    .font(AlgoTypography.titleLarge)
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("Algo")
        }
        .tabItem {
            Label(
                AppTab.chat.rawValue,
                systemImage: router.selectedTab == .chat
                    ? AppTab.chat.selectedIcon
                    : AppTab.chat.icon
            )
        }
        .tag(AppTab.chat)
    }

    // MARK: Dashboard Tab

    private var dashboardTab: some View {
        DashboardView(service: dashboardService)
            .tabItem {
                Label(
                    AppTab.dashboard.rawValue,
                    systemImage: router.selectedTab == .dashboard
                        ? AppTab.dashboard.selectedIcon
                        : AppTab.dashboard.icon
                )
            }
            .tag(AppTab.dashboard)
    }

    // MARK: Growth Tab

    private var growthTab: some View {
        GrowthView(service: growthService)
            .tabItem {
                Label(
                    AppTab.growth.rawValue,
                    systemImage: router.selectedTab == .growth
                        ? AppTab.growth.selectedIcon
                        : AppTab.growth.icon
                )
            }
            .tag(AppTab.growth)
    }

    // MARK: Notifications Tab

    private var notificationsTab: some View {
        NotificationsView(service: notificationService)
            .tabItem {
                Label(
                    AppTab.notifications.rawValue,
                    systemImage: router.selectedTab == .notifications
                        ? AppTab.notifications.selectedIcon
                        : AppTab.notifications.icon
                )
            }
            .tag(AppTab.notifications)
            .badge(unreadCount)
    }

    // MARK: Settings Tab

    private var settingsTab: some View {
        NavigationStack(path: $router.settingsNavigationPath) {
            SettingsView(viewModel: settingsViewModel)
        }
        .tabItem {
            Label(
                AppTab.settings.rawValue,
                systemImage: router.selectedTab == .settings
                    ? AppTab.settings.selectedIcon
                    : AppTab.settings.icon
            )
        }
        .tag(AppTab.settings)
    }
}

// MARK: - AuthViewModel Stub

/// Stub protocol for `AuthViewModel` referenced by `MainTabView`.
/// The full implementation lives in `Features/Auth/ViewModels/AuthViewModel.swift`.
///
/// This class provides the minimum interface required by the tab view.
/// In the actual app, the Auth module's `AuthViewModel` would be used.
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var accessToken: String?

    func logout() {
        isAuthenticated = false
        accessToken = nil
    }
}

// MARK: - Preview

#Preview("Main Tab View") {
    MainTabView(
        dashboardService: PreviewDashboardServiceForTab(),
        growthService: PreviewGrowthServiceForTab(),
        notificationService: PreviewNotificationServiceForTab(),
        settingsViewModel: SettingsViewModel(
            tokenProvider: { "mock" },
            onLogout: {}
        )
    )
    .environmentObject(AppRouter())
    .environmentObject(AuthViewModel())
}

// MARK: - Preview Services

private final class PreviewDashboardServiceForTab: DashboardServiceProtocol {
    func getSummary() async throws -> DashboardSummary {
        DashboardSummary(
            period: "today",
            metrics: DashboardMetrics(
                totalLeads: 47, hotLeads: 5, activeCampaigns: 12,
                totalEngagement: 8934, aiCreditsRemaining: 4500, aiCreditsTotal: 10000,
                revenueToday: 12450, pipelineValue: 89000, pendingFollowups: 8
            ),
            alerts: [],
            updatedAt: "2026-03-01T15:30:00Z"
        )
    }
    func getAlerts() async throws -> [AlertItem] { [] }
}

private final class PreviewGrowthServiceForTab: GrowthServiceProtocol {
    func getRecommendations(limit: Int) async throws -> RecommendationsResponse {
        RecommendationsResponse(recommendations: [], total: 0)
    }
    func acceptRecommendation(id: String) async throws -> AcceptResponse {
        AcceptResponse(confirmationId: "conf_mock", status: "accepted")
    }
    func dismissRecommendation(id: String) async throws -> DismissResponse {
        DismissResponse(status: "dismissed")
    }
    func getExecutionHistory(limit: Int) async throws -> ExecutionHistoryResponse {
        ExecutionHistoryResponse(executions: [])
    }
    func getSafetyStatus() async throws -> SafetyStatus {
        SafetyStatus(hourlyUsed: 0, dailyUsed: 0, limits: SafetyLimits(maxActionsPerHour: 5, maxActionsPerDay: 20, requireConfirmation: true))
    }
}

private final class PreviewNotificationServiceForTab: NotificationServiceProtocol {
    func getNotifications(page: Int, unreadOnly: Bool) async throws -> NotificationListResponse {
        NotificationListResponse(notifications: [], unreadCount: 0)
    }
    func markAsRead(id: String) async throws {}
    func markAllAsRead() async throws {}
}
