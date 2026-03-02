// AppDelegate.swift
// Algo
//
// UIApplicationDelegate for handling push notification registration,
// APNs device token management, and notification tap routing.

import UIKit
import UserNotifications

// MARK: - AppDelegate

/// Application delegate responsible for push notification lifecycle management.
///
/// Responsibilities:
/// - Registers for remote notifications on launch
/// - Receives and forwards APNs device tokens to the push handler
/// - Handles notification taps when the app is launched from a notification
/// - Sets up the notification center delegate
class AppDelegate: NSObject, UIApplicationDelegate {

    // MARK: Properties

    /// The push notification handler. Set by `AlgoApp` during initialization.
    var pushHandler: PushNotificationHandler?

    /// The app router for deep link navigation. Set by `AlgoApp` during initialization.
    var router: AppRouter?

    // MARK: UIApplicationDelegate

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Set up the notification center delegate for foreground notifications
        if let pushHandler {
            UNUserNotificationCenter.current().delegate = pushHandler
        }

        // Check if the app was launched from a notification
        if let notificationPayload = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
            handleLaunchNotification(notificationPayload)
        }

        return true
    }

    /// Called when the app successfully registers for remote notifications.
    /// Forwards the device token to the push notification handler.
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        pushHandler?.handleDeviceToken(deviceToken)
    }

    /// Called when remote notification registration fails.
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        pushHandler?.handleRegistrationError(error)
    }

    /// Called when a remote notification arrives while the app is running.
    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        // Parse the notification payload for any real-time data updates
        _ = pushHandler?.parseNotificationPayload(userInfo)
        completionHandler(.newData)
    }

    // MARK: Private Helpers

    /// Handles a notification that caused the app to launch.
    private func handleLaunchNotification(_ userInfo: [AnyHashable: Any]) {
        // Delay handling to ensure the router is available
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            if let actionUrl = userInfo["action_url"] as? String,
               let router = self?.router {
                DeepLinkHandler.handleNotificationAction(actionUrl, using: router)
            }
        }
    }
}
