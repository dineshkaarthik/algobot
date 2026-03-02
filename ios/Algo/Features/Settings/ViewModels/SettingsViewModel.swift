// SettingsViewModel.swift
// Algo
//
// ViewModel for the Settings screen. Manages user info,
// notification preferences, and logout functionality.

import Foundation

// MARK: - UserInfo

/// Represents the currently authenticated user's profile information.
struct UserInfo: Codable, Sendable {
    let id: String
    let email: String
    let name: String
    let role: String
    let tenantId: String
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, email, name, role
        case tenantId = "tenant_id"
        case avatarUrl = "avatar_url"
    }
}

// MARK: - NotificationPreference

/// Notification settings for a single alert type.
struct NotificationPreference: Codable, Sendable, Identifiable {
    var id: String { alertType }

    /// The alert type key (e.g., "hot_lead", "campaign_drop").
    let alertType: String

    /// Whether this alert type is enabled.
    var enabled: Bool

    /// Whether push notifications are sent for this type.
    var push: Bool

    /// Whether email notifications are sent for this type.
    var email: Bool

    /// Optional threshold percentage (used by budget_alert).
    var thresholdPct: Int?

    /// Optional absolute threshold (used by credit_low).
    var threshold: Int?
}

// MARK: - NotificationSettings

/// Complete notification settings for all alert types.
struct NotificationSettings: Codable, Sendable {
    var hotLead: NotificationPreference
    var campaignDrop: NotificationPreference
    var budgetAlert: NotificationPreference
    var revenueSpike: NotificationPreference
    var creditLow: NotificationPreference
    var followupOverdue: NotificationPreference

    /// Returns all preferences as an ordered array for iteration.
    var allPreferences: [NotificationPreference] {
        [hotLead, campaignDrop, budgetAlert, revenueSpike, creditLow, followupOverdue]
    }

    /// Default notification settings with all alerts enabled.
    static let `default` = NotificationSettings(
        hotLead: NotificationPreference(
            alertType: "hot_lead", enabled: true, push: true, email: true
        ),
        campaignDrop: NotificationPreference(
            alertType: "campaign_drop", enabled: true, push: true, email: false
        ),
        budgetAlert: NotificationPreference(
            alertType: "budget_alert", enabled: true, push: true, email: true,
            thresholdPct: 80
        ),
        revenueSpike: NotificationPreference(
            alertType: "revenue_spike", enabled: true, push: false, email: true
        ),
        creditLow: NotificationPreference(
            alertType: "credit_low", enabled: true, push: true, email: true,
            threshold: 500
        ),
        followupOverdue: NotificationPreference(
            alertType: "followup_overdue", enabled: true, push: true, email: false
        )
    )
}

// MARK: - SettingsViewModel

/// Manages the state and business logic for the Settings screen.
///
/// Responsibilities:
/// - Loads and displays current user info
/// - Manages notification preference settings
/// - Handles logout flow
@MainActor
final class SettingsViewModel: ObservableObject {

    // MARK: Published State

    /// Current user profile information.
    @Published private(set) var user: UserInfo?

    /// Notification settings for all alert types.
    @Published var notificationSettings: NotificationSettings = .default

    /// Whether data is being loaded.
    @Published private(set) var isLoading = false

    /// Whether settings are being saved.
    @Published private(set) var isSaving = false

    /// Current error message, if any.
    @Published private(set) var error: String?

    /// Whether the user has been successfully logged out.
    @Published private(set) var didLogout = false

    // MARK: Dependencies

    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?
    private let onLogout: () -> Void

    // MARK: Initialization

    /// Creates a new `SettingsViewModel`.
    /// - Parameters:
    ///   - baseURL: The base URL for the Algo API.
    ///   - session: URL session for requests.
    ///   - tokenProvider: Closure returning the current JWT token.
    ///   - onLogout: Closure called when the user logs out.
    init(
        baseURL: URL = URL(string: "https://api.algo.algonit.com/v1")!,
        session: URLSession = .shared,
        tokenProvider: @escaping @Sendable () -> String?,
        onLogout: @escaping () -> Void
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
        self.onLogout = onLogout
    }

    // MARK: Public Methods

    /// Loads user info and notification settings from the backend.
    func loadSettings() async {
        isLoading = true
        error = nil

        // In a production app, these would be separate API calls.
        // For now, user info is typically cached from the login response.
        // Notification settings would come from GET /notifications/settings.

        isLoading = false
    }

    /// Sets the user info (typically called after login).
    /// - Parameter user: The authenticated user's profile.
    func setUser(_ user: UserInfo) {
        self.user = user
    }

    /// Updates notification settings on the backend.
    func updateNotificationSettings() async {
        isSaving = true
        error = nil

        do {
            let url = baseURL.appendingPathComponent("notifications/settings")
            var request = URLRequest(url: url)
            request.httpMethod = "PUT"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")

            if let token = tokenProvider() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            let payload = buildNotificationSettingsPayload()
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (_, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode) else {
                throw SettingsError.saveFailed
            }
        } catch {
            self.error = "Failed to save notification settings."
        }

        isSaving = false
    }

    /// Logs the user out by calling the backend and clearing local state.
    func logout() async {
        do {
            let url = baseURL.appendingPathComponent("auth/logout")
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            if let token = tokenProvider() {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }

            let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? ""
            let body = ["device_id": deviceId]
            request.httpBody = try JSONEncoder().encode(body)

            // Fire and forget - we log out locally regardless
            _ = try? await session.data(for: request)
        } catch {
            // Proceed with local logout even if the network call fails
        }

        didLogout = true
        onLogout()
    }

    // MARK: Private Helpers

    /// Builds the notification settings payload for the API.
    private func buildNotificationSettingsPayload() -> [String: Any] {
        var payload: [String: Any] = [:]

        func prefDict(_ pref: NotificationPreference) -> [String: Any] {
            var dict: [String: Any] = [
                "enabled": pref.enabled,
                "push": pref.push,
                "email": pref.email
            ]
            if let thresholdPct = pref.thresholdPct {
                dict["threshold_pct"] = thresholdPct
            }
            if let threshold = pref.threshold {
                dict["threshold"] = threshold
            }
            return dict
        }

        payload["hot_lead"] = prefDict(notificationSettings.hotLead)
        payload["campaign_drop"] = prefDict(notificationSettings.campaignDrop)
        payload["budget_alert"] = prefDict(notificationSettings.budgetAlert)
        payload["revenue_spike"] = prefDict(notificationSettings.revenueSpike)
        payload["credit_low"] = prefDict(notificationSettings.creditLow)
        payload["followup_overdue"] = prefDict(notificationSettings.followupOverdue)

        return payload
    }
}

// MARK: - SettingsError

enum SettingsError: LocalizedError {
    case saveFailed

    var errorDescription: String? {
        switch self {
        case .saveFailed:
            return "Failed to save settings. Please try again."
        }
    }
}

// MARK: - UIDevice Import

import UIKit
