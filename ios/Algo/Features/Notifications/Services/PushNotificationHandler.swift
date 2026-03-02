// PushNotificationHandler.swift
// Algo
//
// Handles push notification registration, APNs token management,
// notification payload parsing, and deep link routing.

import Foundation
import UIKit
import UserNotifications

// MARK: - PushNotificationHandler

/// Manages the full push notification lifecycle:
/// 1. Requests notification permission from the user
/// 2. Registers for remote notifications
/// 3. Sends the APNs device token to the backend
/// 4. Parses incoming notification payloads
/// 5. Routes tapped notifications to the correct screen
@MainActor
final class PushNotificationHandler: NSObject, ObservableObject {

    // MARK: Published State

    /// Whether the user has granted notification permission.
    @Published private(set) var isAuthorized = false

    /// The current APNs device token in hex string format.
    @Published private(set) var deviceToken: String?

    /// The current badge count.
    @Published var badgeCount: Int = 0

    // MARK: Dependencies

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?

    /// Closure called when a notification is tapped, with the parsed deep link URL.
    var onNotificationTapped: ((String) -> Void)?

    // MARK: Initialization

    /// Creates a new `PushNotificationHandler`.
    /// - Parameters:
    ///   - baseURL: The base URL for the Algo API.
    ///   - session: The URL session to use for requests. Defaults to `.shared`.
    ///   - tokenProvider: A closure that returns the current JWT access token.
    init(
        baseURL: URL = URL(string: "https://api.algo.algonit.com/v1")!,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () -> String?
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
        super.init()
    }

    // MARK: Permission & Registration

    /// Requests notification permission and registers for remote notifications.
    /// Call this early in the app lifecycle (e.g., after successful login).
    func requestPermissionAndRegister() async {
        let center = UNUserNotificationCenter.current()

        do {
            let granted = try await center.requestAuthorization(
                options: [.alert, .badge, .sound]
            )
            isAuthorized = granted

            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        } catch {
            isAuthorized = false
        }
    }

    /// Checks the current notification authorization status without prompting.
    func checkAuthorizationStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        isAuthorized = settings.authorizationStatus == .authorized
    }

    // MARK: APNs Token Handling

    /// Called when the app receives an APNs device token.
    /// Converts the token to a hex string and registers it with the backend.
    /// - Parameter tokenData: The raw APNs token data from the system.
    func handleDeviceToken(_ tokenData: Data) {
        let tokenString = tokenData.map { String(format: "%02.2hhx", $0) }.joined()
        deviceToken = tokenString

        Task {
            await registerDeviceWithBackend(pushToken: tokenString)
        }
    }

    /// Called when APNs registration fails.
    /// - Parameter error: The registration error.
    func handleRegistrationError(_ error: Error) {
        deviceToken = nil
    }

    // MARK: Notification Payload Handling

    /// Parses an incoming notification payload and extracts the action URL.
    /// - Parameter userInfo: The notification payload dictionary.
    /// - Returns: The action URL string if present, or `nil`.
    func parseNotificationPayload(_ userInfo: [AnyHashable: Any]) -> String? {
        // Expected payload structure:
        // {
        //   "aps": { "alert": { "title": "...", "body": "..." }, "badge": 3 },
        //   "action_url": "/leads/lead_sarah_001",
        //   "notification_id": "notif_001",
        //   "type": "hot_lead"
        // }

        // Update badge count from payload
        if let aps = userInfo["aps"] as? [String: Any],
           let badge = aps["badge"] as? Int {
            badgeCount = badge
        }

        return userInfo["action_url"] as? String
    }

    /// Handles a tapped notification by routing to the appropriate screen.
    /// - Parameter userInfo: The notification payload dictionary.
    func handleNotificationTap(_ userInfo: [AnyHashable: Any]) {
        if let actionUrl = parseNotificationPayload(userInfo) {
            onNotificationTapped?(actionUrl)
        }
    }

    // MARK: Badge Management

    /// Clears the app badge count on the home screen.
    func clearBadge() async {
        do {
            try await UNUserNotificationCenter.current().setBadgeCount(0)
            badgeCount = 0
        } catch {
            // Badge clearing failed; non-critical.
        }
    }

    /// Updates the badge count to reflect unread notifications.
    /// - Parameter count: The new badge count.
    func updateBadge(count: Int) async {
        do {
            try await UNUserNotificationCenter.current().setBadgeCount(count)
            badgeCount = count
        } catch {
            // Badge update failed; non-critical.
        }
    }

    // MARK: Backend Registration

    /// Registers the device with the Algo backend for push notification delivery.
    /// - Parameter pushToken: The APNs device token as a hex string.
    private func registerDeviceWithBackend(pushToken: String) async {
        let url = baseURL.appendingPathComponent("devices/register")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
        let payload: [String: String] = [
            "device_id": deviceId,
            "device_type": "ios",
            "push_token": pushToken,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
            "os_version": "iOS \(UIDevice.current.systemVersion)"
        ]

        do {
            request.httpBody = try JSONEncoder().encode(payload)
            let (_, response) = try await session.data(for: request)

            if let httpResponse = response as? HTTPURLResponse,
               !(200...299).contains(httpResponse.statusCode) {
                // Registration failed; will retry on next app launch.
            }
        } catch {
            // Network error; will retry on next app launch.
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension PushNotificationHandler: UNUserNotificationCenterDelegate {

    /// Called when a notification is received while the app is in the foreground.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .badge, .sound]
    }

    /// Called when the user taps a notification.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        await handleNotificationTap(userInfo)
    }
}
