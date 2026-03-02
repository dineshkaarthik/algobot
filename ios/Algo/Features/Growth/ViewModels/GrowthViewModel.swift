// GrowthViewModel.swift
// Algo
//
// ViewModel for the Growth Copilot screen. Manages loading state,
// recommendations, execution history, safety status, and user actions.

import Foundation
import Combine

// MARK: - GrowthViewModel

/// Manages the state and business logic for the Growth Copilot screen.
///
/// Responsibilities:
/// - Fetches recommendations from the backend
/// - Handles accept/dismiss actions on recommendations
/// - Loads execution history
/// - Tracks safety limiter status
/// - Exposes loading and error states for the UI
@MainActor
final class GrowthViewModel: ObservableObject {

    // MARK: Published State

    /// Current list of AI-generated recommendations.
    @Published private(set) var recommendations: [Recommendation] = []

    /// Execution history of previously acted-on recommendations.
    @Published private(set) var executionHistory: [ExecutionEntry] = []

    /// Current safety limiter status. `nil` until first successful load.
    @Published private(set) var safetyStatus: SafetyStatus?

    /// Whether the initial data load is in progress (shows shimmer).
    @Published private(set) var isLoading = false

    /// Whether a background refresh is in progress (pull-to-refresh).
    @Published private(set) var isRefreshing = false

    /// Current error message, if any. Cleared on successful load.
    @Published private(set) var error: String?

    /// Set of recommendation IDs currently being processed (accept/dismiss).
    @Published private(set) var processingIds: Set<String> = []

    // MARK: Dependencies

    private let growthService: GrowthServiceProtocol

    // MARK: Initialization

    /// Creates a new `GrowthViewModel`.
    /// - Parameter growthService: The growth service to use for API calls.
    init(growthService: GrowthServiceProtocol) {
        self.growthService = growthService
    }

    // MARK: Public Methods

    /// Loads recommendations and safety status. Shows loading shimmer on first load.
    /// Call this from `.task` on the view's appearance.
    func loadRecommendations() async {
        let isFirstLoad = recommendations.isEmpty && error == nil

        if isFirstLoad {
            isLoading = true
        }

        await fetchRecommendations()
        await fetchSafetyStatus()

        if isFirstLoad {
            isLoading = false
        }
    }

    /// Refreshes recommendations data. Used for pull-to-refresh.
    /// Does not show the full-screen loading shimmer.
    func refresh() async {
        isRefreshing = true
        await fetchRecommendations()
        await fetchSafetyStatus()
        isRefreshing = false
    }

    /// Accepts a recommendation for execution.
    /// - Parameter id: The recommendation identifier to accept.
    func acceptRecommendation(_ id: String) async {
        processingIds.insert(id)
        defer { processingIds.remove(id) }

        do {
            _ = try await growthService.acceptRecommendation(id: id)

            // Update local state to reflect the acceptance
            if let index = recommendations.firstIndex(where: { $0.id == id }) {
                let updated = recommendations[index]
                // Remove the accepted recommendation from the pending list
                recommendations.remove(at: index)

                // Refresh execution history to show the new entry
                await fetchHistory()
                await fetchSafetyStatus()

                _ = updated // Suppress unused variable warning
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Dismisses a recommendation.
    /// - Parameter id: The recommendation identifier to dismiss.
    func dismissRecommendation(_ id: String) async {
        processingIds.insert(id)
        defer { processingIds.remove(id) }

        do {
            _ = try await growthService.dismissRecommendation(id: id)

            // Remove the dismissed recommendation from the list
            recommendations.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Loads the execution history.
    func loadHistory() async {
        await fetchHistory()
    }

    // MARK: Private Methods

    /// Fetches recommendations from the backend.
    private func fetchRecommendations() async {
        do {
            let response = try await growthService.getRecommendations(limit: 20)
            recommendations = response.recommendations
            error = nil
        } catch {
            if recommendations.isEmpty {
                self.error = error.localizedDescription
            }
        }
    }

    /// Fetches execution history from the backend.
    private func fetchHistory() async {
        do {
            let response = try await growthService.getExecutionHistory(limit: 50)
            executionHistory = response.executions
        } catch {
            // History fetch failures are non-critical; don't overwrite primary error
        }
    }

    /// Fetches the current safety limiter status.
    private func fetchSafetyStatus() async {
        do {
            safetyStatus = try await growthService.getSafetyStatus()
        } catch {
            // Safety status fetch failures are non-critical
        }
    }
}
