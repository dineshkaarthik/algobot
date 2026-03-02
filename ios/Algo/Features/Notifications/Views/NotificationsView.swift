// NotificationsView.swift
// Algo
//
// Notification list screen with filter chips, pull-to-refresh,
// mark-all-read action, and empty state handling.

import SwiftUI

// MARK: - NotificationsView

/// Displays the user's notifications with filtering and management controls.
///
/// Features:
/// - Filter chips: All / Unread
/// - Pull-to-refresh
/// - Mark all as read button in toolbar
/// - Empty state when no notifications exist
/// - Infinite scroll pagination
struct NotificationsView: View {

    // MARK: Properties

    @StateObject private var viewModel: NotificationsViewModel
    @EnvironmentObject private var router: AppRouter

    // MARK: Initialization

    init(service: NotificationServiceProtocol) {
        self._viewModel = StateObject(wrappedValue: NotificationsViewModel(service: service))
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Notifications")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        if viewModel.unreadCount > 0 {
                            Button {
                                Task { await viewModel.markAllAsRead() }
                            } label: {
                                Text("Mark All Read")
                                    .font(AlgoTypography.labelMedium)
                            }
                        }
                    }
                }
        }
        .task {
            await viewModel.loadNotifications()
        }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading && viewModel.notifications.isEmpty {
            LoadingView(message: "Loading notifications...")
        } else if let error = viewModel.error, viewModel.notifications.isEmpty {
            ErrorView(
                message: error,
                detail: "Could not load your notifications.",
                isFullScreen: true,
                retryAction: {
                    Task { await viewModel.loadNotifications() }
                }
            )
        } else {
            listContent
        }
    }

    // MARK: List Content

    private var listContent: some View {
        VStack(spacing: 0) {
            // Filter chips
            filterBar

            if viewModel.notifications.isEmpty {
                emptyState
            } else {
                notificationList
            }
        }
    }

    // MARK: Filter Bar

    private var filterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                ForEach(NotificationFilter.allCases) { filter in
                    FilterChip(
                        title: filter.rawValue,
                        isSelected: viewModel.selectedFilter == filter,
                        count: filter == .unread ? viewModel.unreadCount : nil
                    ) {
                        viewModel.selectedFilter = filter
                    }
                }
            }
            .padding(.horizontal, AlgoTheme.Spacing.md)
            .padding(.vertical, AlgoTheme.Spacing.xs)
        }
        .background(AlgoTheme.Colors.surface)
    }

    // MARK: Notification List

    private var notificationList: some View {
        List {
            ForEach(viewModel.notifications) { notification in
                NotificationRow(
                    notification: notification,
                    onMarkAsRead: {
                        Task { await viewModel.markAsRead(notification) }
                    },
                    onTap: {
                        Task { await viewModel.markAsRead(notification) }
                        if let actionUrl = notification.actionUrl {
                            router.handleDeepLink(url: actionUrl)
                        }
                    }
                )
                .onAppear {
                    Task { await viewModel.loadMoreIfNeeded(currentItem: notification) }
                }
            }

            if viewModel.isLoadingMore {
                HStack {
                    Spacer()
                    ProgressView()
                        .padding()
                    Spacer()
                }
                .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: Empty State

    private var emptyState: some View {
        ContentUnavailableView {
            Label(
                viewModel.selectedFilter == .unread
                    ? "All Caught Up"
                    : "No Notifications",
                systemImage: viewModel.selectedFilter == .unread
                    ? "checkmark.circle"
                    : "bell.slash"
            )
        } description: {
            Text(
                viewModel.selectedFilter == .unread
                    ? "You have no unread notifications."
                    : "You don't have any notifications yet. They'll appear here when something needs your attention."
            )
        }
    }
}

// MARK: - FilterChip

/// A selectable chip button used for notification filtering.
private struct FilterChip: View {

    let title: String
    let isSelected: Bool
    let count: Int?
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: AlgoTheme.Spacing.xxs) {
                Text(title)
                    .font(AlgoTypography.labelMedium)

                if let count, count > 0 {
                    Text("\(count)")
                        .font(AlgoTypography.labelSmall)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            isSelected
                                ? Color.white.opacity(0.3)
                                : AlgoTheme.Colors.primary.opacity(0.2)
                        )
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal, AlgoTheme.Spacing.sm)
            .padding(.vertical, AlgoTheme.Spacing.xs)
            .foregroundStyle(isSelected ? .white : AlgoTheme.Colors.textPrimary)
            .background(
                isSelected
                    ? AlgoTheme.Colors.primary
                    : AlgoTheme.Colors.secondaryBackground
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title)\(count.map { ", \($0) items" } ?? "")")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

// MARK: - Preview

#Preview("Notifications") {
    NotificationsView(service: PreviewNotificationService())
        .environmentObject(AppRouter())
}

/// Mock service for SwiftUI previews.
private final class PreviewNotificationService: NotificationServiceProtocol {

    func getNotifications(page: Int, unreadOnly: Bool) async throws -> NotificationListResponse {
        NotificationListResponse(
            notifications: [
                AppNotification(
                    id: "notif_001",
                    type: "hot_lead",
                    title: "Hot Lead Detected",
                    body: "Sarah Johnson from TechCorp has high engagement score (92/100)",
                    severity: "high",
                    read: false,
                    actionUrl: "/leads/lead_sarah_001",
                    createdAt: "2026-03-01T14:20:00Z"
                ),
                AppNotification(
                    id: "notif_002",
                    type: "campaign_drop",
                    title: "Campaign Performance Drop",
                    body: "Spring Sale campaign engagement dropped 23%",
                    severity: "medium",
                    read: true,
                    actionUrl: nil,
                    createdAt: "2026-03-01T10:00:00Z"
                )
            ],
            unreadCount: 1
        )
    }

    func markAsRead(id: String) async throws {}
    func markAllAsRead() async throws {}
}
