// DashboardViewModel.swift
// Algo
//
// ViewModel for the Dashboard screen. Manages loading state,
// metrics data, alerts, and auto-refresh behavior.

import Foundation
import Combine

// MARK: - DashboardViewModel

/// Manages the state and business logic for the Dashboard screen.
///
/// Responsibilities:
/// - Fetches dashboard summary (metrics + alerts) from the backend
/// - Auto-refreshes every 5 minutes while active
/// - Supports manual pull-to-refresh
/// - Exposes loading and error states for the UI
@MainActor
final class DashboardViewModel: ObservableObject {

    // MARK: Published State

    /// Current dashboard metrics. `nil` until first successful load.
    @Published private(set) var metrics: DashboardMetrics?

    /// Active alerts sorted by creation time (newest first).
    @Published private(set) var alerts: [AlertItem] = []

    /// Whether the initial data load is in progress (shows shimmer).
    @Published private(set) var isLoading = false

    /// Whether a background refresh is in progress (pull-to-refresh).
    @Published private(set) var isRefreshing = false

    /// Current error message, if any. Cleared on successful load.
    @Published private(set) var error: String?

    /// ISO 8601 timestamp of the last successful data update.
    @Published private(set) var lastUpdated: String?

    // MARK: Dependencies

    private let service: DashboardServiceProtocol

    // MARK: Auto-Refresh

    /// Interval between automatic refreshes (5 minutes).
    private static let autoRefreshInterval: TimeInterval = 300

    /// Task handle for the auto-refresh timer.
    private var autoRefreshTask: Task<Void, Never>?

    // MARK: Initialization

    /// Creates a new `DashboardViewModel`.
    /// - Parameter service: The dashboard service to use for API calls.
    init(service: DashboardServiceProtocol) {
        self.service = service
    }

    deinit {
        autoRefreshTask?.cancel()
    }

    // MARK: Public Methods

    /// Loads the dashboard data. Shows loading shimmer on first load.
    /// Call this from `.task` on the view's appearance.
    func loadDashboard() async {
        let isFirstLoad = metrics == nil

        if isFirstLoad {
            isLoading = true
        }

        await fetchSummary()

        if isFirstLoad {
            isLoading = false
            startAutoRefresh()
        }
    }

    /// Refreshes the dashboard data. Used for pull-to-refresh.
    /// Does not show the full-screen loading shimmer.
    func refresh() async {
        isRefreshing = true
        await fetchSummary()
        isRefreshing = false
    }

    /// Starts the auto-refresh timer. Cancels any existing timer.
    func startAutoRefresh() {
        autoRefreshTask?.cancel()
        autoRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(Self.autoRefreshInterval))
                guard !Task.isCancelled else { break }
                await self?.fetchSummary()
            }
        }
    }

    /// Stops the auto-refresh timer. Call when the view disappears.
    func stopAutoRefresh() {
        autoRefreshTask?.cancel()
        autoRefreshTask = nil
    }

    // MARK: Private Methods

    /// Fetches the dashboard summary from the backend.
    private func fetchSummary() async {
        do {
            let summary = try await service.getSummary()
            metrics = summary.metrics
            alerts = summary.alerts
            lastUpdated = summary.updatedAt
            error = nil
        } catch {
            // Only set error if we have no cached data to show
            if metrics == nil {
                self.error = error.localizedDescription
            }
        }
    }
}
