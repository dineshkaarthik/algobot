// AlgoApp.swift
// Algo
//
// Main entry point for the Algo iOS application.
// Configures the app environment, dependency injection,
// authentication routing, and push notification setup.

import SwiftUI

// MARK: - AlgoApp

/// The root application structure for Algo.
///
/// Responsibilities:
/// - Manages the `WindowGroup` scene
/// - Injects environment objects (AuthViewModel, AppRouter)
/// - Routes between login and main app based on auth state
/// - Configures the AppDelegate for push notification handling
/// - Handles universal links and custom URL schemes
@main
struct AlgoApp: App {

    // MARK: Properties

    /// AppDelegate adaptor for UIKit integration (push notifications).
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    /// Authentication state manager.
    @StateObject private var authViewModel = AuthViewModel()

    /// Navigation coordinator.
    @StateObject private var router = AppRouter()

    /// Push notification handler.
    @StateObject private var pushHandler: PushNotificationHandler

    /// Tracks whether the user has completed the onboarding flow.
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    /// Tracks the user's preferred color scheme (system / light / dark).
    @AppStorage("appColorScheme") private var colorSchemeRaw = AppColorScheme.system.rawValue

    /// Monitors app lifecycle for biometric lock on foreground return.
    @Environment(\.scenePhase) private var scenePhase

    /// Dashboard service instance.
    private let dashboardService: DashboardServiceProtocol

    /// Growth service instance.
    private let growthService: GrowthServiceProtocol

    /// Notification service instance.
    private let notificationService: NotificationServiceProtocol

    /// Settings view model instance.
    private let settingsViewModel: SettingsViewModel

    // MARK: Initialization

    init() {
        // Create shared token provider
        // In production, this would read from KeychainManager
        let authVM = AuthViewModel()
        let tokenProvider: @Sendable () -> String? = { [weak authVM] in
            authVM?.accessToken
        }

        let push = PushNotificationHandler(tokenProvider: tokenProvider)
        let dashboard = DashboardService(tokenProvider: tokenProvider)
        let growth = GrowthService(tokenProvider: tokenProvider)
        let notification = NotificationService(tokenProvider: tokenProvider)
        let settings = SettingsViewModel(
            tokenProvider: tokenProvider,
            onLogout: { [weak authVM] in
                authVM?.logout()
            }
        )

        self._authViewModel = StateObject(wrappedValue: authVM)
        self._pushHandler = StateObject(wrappedValue: push)
        self.dashboardService = dashboard
        self.growthService = growth
        self.notificationService = notification
        self.settingsViewModel = settings
    }

    // MARK: Scene

    var body: some Scene {
        WindowGroup {
            Group {
                if !hasCompletedOnboarding {
                    OnboardingView()
                } else if authViewModel.isBiometricLocked {
                    biometricLockScreen
                } else if authViewModel.isAuthenticated {
                    MainTabView(
                        dashboardService: dashboardService,
                        growthService: growthService,
                        notificationService: notificationService,
                        settingsViewModel: settingsViewModel
                    )
                    .environmentObject(router)
                    .onAppear {
                        setupPushNotifications()
                    }
                } else {
                    loginPlaceholder
                }
            }
            .environmentObject(authViewModel)
            .preferredColorScheme(AppColorScheme(rawValue: colorSchemeRaw)?.colorScheme)
            .onOpenURL { url in
                handleIncomingURL(url)
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    Task { await authViewModel.checkBiometric() }
                }
            }
            .task {
                // Wire up the app delegate references
                appDelegate.pushHandler = pushHandler
                appDelegate.router = router

                // Set up notification center delegate
                UNUserNotificationCenter.current().delegate = pushHandler
            }
        }
    }

    // MARK: Login Placeholder

    /// Placeholder login view. In production, this would be replaced
    /// with the full LoginView from the Auth feature module.
    private var loginPlaceholder: some View {
        VStack(spacing: AlgoTheme.Spacing.xl) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 64))
                .foregroundStyle(AlgoTheme.Colors.primary)

            Text("Algo")
                .font(AlgoTypography.displayLarge)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)

            Text("AI Assistant for Algonit")
                .font(AlgoTypography.subheadline)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)

            AlgoButton("Sign In", style: .primary, isFullWidth: true) {
                // Placeholder: In production, navigates to LoginView
                authViewModel.isAuthenticated = true
            }
            .padding(.horizontal, AlgoTheme.Spacing.xxl)
            .padding(.top, AlgoTheme.Spacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AlgoTheme.Colors.background)
    }

    // MARK: Biometric Lock Screen

    /// Displayed when the app is locked behind biometric authentication.
    private var biometricLockScreen: some View {
        VStack(spacing: AlgoTheme.Spacing.xl) {
            Image(systemName: "lock.fill")
                .font(.system(size: 48))
                .foregroundStyle(AlgoTheme.Colors.primary)

            Text("Algo is Locked")
                .font(AlgoTypography.titleLarge)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)

            Text("Authenticate to continue")
                .font(AlgoTypography.bodyMedium)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)

            AlgoButton("Unlock", style: .primary, isFullWidth: false) {
                Task { await authViewModel.checkBiometric() }
            }
            .padding(.top, AlgoTheme.Spacing.md)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AlgoTheme.Colors.background)
    }

    // MARK: Push Notification Setup

    /// Requests push notification permission and registers the device.
    private func setupPushNotifications() {
        // Wire up the notification tap handler to the router
        pushHandler.onNotificationTapped = { [weak router] actionUrl in
            guard let router else { return }
            DeepLinkHandler.handleNotificationAction(actionUrl, using: router)
        }

        Task {
            await pushHandler.requestPermissionAndRegister()
        }
    }

    // MARK: URL Handling

    /// Handles incoming URLs from universal links and custom URL schemes.
    private func handleIncomingURL(_ url: URL) {
        guard authViewModel.isAuthenticated else { return }
        DeepLinkHandler.handleURL(url, using: router)
    }
}

// MARK: - UserNotifications Import

import UserNotifications
