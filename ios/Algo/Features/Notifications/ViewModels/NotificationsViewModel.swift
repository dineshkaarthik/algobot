// NotificationsViewModel.swift
// Algo
//
// ViewModel for the Notifications screen. Manages notification list,
// filtering, read status, and pagination.

import Foundation

// MARK: - NotificationFilter

/// Filter options for the notification list.
enum NotificationFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case unread = "Unread"

    var id: String { rawValue }
}

// MARK: - NotificationsViewModel

/// Manages the state and business logic for the Notifications screen.
///
/// Responsibilities:
/// - Fetches paginated notifications from the backend
/// - Filters by all vs. unread
/// - Marks individual notifications as read
/// - Marks all notifications as read
/// - Tracks unread count for the tab badge
@MainActor
final class NotificationsViewModel: ObservableObject {

    // MARK: Published State

    /// The current list of notifications.
    @Published private(set) var notifications: [AppNotification] = []

    /// Total count of unread notifications.
    @Published private(set) var unreadCount: Int = 0

    /// Whether a data load is in progress.
    @Published private(set) var isLoading = false

    /// Current error message, if any.
    @Published private(set) var error: String?

    /// The active filter selection.
    @Published var selectedFilter: NotificationFilter = .all {
        didSet {
            if oldValue != selectedFilter {
                Task { await loadNotifications() }
            }
        }
    }

    // MARK: Pagination

    /// Current page for pagination.
    private var currentPage = 1

    /// Whether more pages are available.
    private(set) var hasMorePages = true

    /// Whether a page load is in progress (for infinite scroll).
    @Published private(set) var isLoadingMore = false

    // MARK: Dependencies

    private let service: NotificationServiceProtocol

    // MARK: Initialization

    /// Creates a new `NotificationsViewModel`.
    /// - Parameter service: The notification service to use for API calls.
    init(service: NotificationServiceProtocol) {
        self.service = service
    }

    // MARK: Public Methods

    /// Loads the first page of notifications.
    /// Call this from `.task` on the view's appearance.
    func loadNotifications() async {
        isLoading = true
        error = nil
        currentPage = 1
        hasMorePages = true

        do {
            let response = try await service.getNotifications(
                page: 1,
                unreadOnly: selectedFilter == .unread
            )
            notifications = response.notifications
            unreadCount = response.unreadCount
            hasMorePages = response.notifications.count >= 20
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    /// Loads the next page of notifications for infinite scroll.
    func loadMoreIfNeeded(currentItem: AppNotification) async {
        guard hasMorePages,
              !isLoadingMore,
              let lastItem = notifications.last,
              currentItem.id == lastItem.id
        else { return }

        isLoadingMore = true
        currentPage += 1

        do {
            let response = try await service.getNotifications(
                page: currentPage,
                unreadOnly: selectedFilter == .unread
            )
            notifications.append(contentsOf: response.notifications)
            unreadCount = response.unreadCount
            hasMorePages = response.notifications.count >= 20
        } catch {
            currentPage -= 1
        }

        isLoadingMore = false
    }

    /// Refreshes the notification list (pull-to-refresh).
    func refresh() async {
        await loadNotifications()
    }

    /// Marks a single notification as read and updates the local state.
    /// - Parameter notification: The notification to mark as read.
    func markAsRead(_ notification: AppNotification) async {
        guard !notification.read else { return }

        do {
            try await service.markAsRead(id: notification.id)

            // Update local state optimistically
            if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
                // Create an updated copy. Since AppNotification properties are `let`,
                // we replace the item entirely.
                let updated = AppNotification(
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    body: notification.body,
                    severity: notification.severity,
                    read: true,
                    actionUrl: notification.actionUrl,
                    createdAt: notification.createdAt
                )
                notifications[index] = updated
                unreadCount = max(0, unreadCount - 1)
            }
        } catch {
            // Silently fail; the notification will remain as unread.
        }
    }

    /// Marks all notifications as read.
    func markAllAsRead() async {
        do {
            try await service.markAllAsRead()

            // Update all local notifications to read
            notifications = notifications.map { notification in
                AppNotification(
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    body: notification.body,
                    severity: notification.severity,
                    read: true,
                    actionUrl: notification.actionUrl,
                    createdAt: notification.createdAt
                )
            }
            unreadCount = 0
        } catch {
            self.error = "Failed to mark all as read."
        }
    }
}
