// GrowthView.swift
// Algo
//
// Main Growth Copilot screen displaying AI-generated recommendations,
// growth summary, and execution history. Supports pull-to-refresh
// and navigation to detailed history view.

import SwiftUI

// MARK: - GrowthView

/// The primary Growth Copilot screen showing AI recommendations at a glance.
///
/// Layout:
/// 1. Safety status bar (actions remaining today)
/// 2. Recommendations list
/// 3. Execution History navigation link
struct GrowthView: View {

    // MARK: Properties

    @StateObject private var viewModel: GrowthViewModel
    @EnvironmentObject private var router: AppRouter

    // MARK: Initialization

    init(service: GrowthServiceProtocol) {
        self._viewModel = StateObject(wrappedValue: GrowthViewModel(growthService: service))
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Growth")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        safetyStatusLabel
                    }
                }
        }
        .task {
            await viewModel.loadRecommendations()
        }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            shimmerContent
        } else if let error = viewModel.error, viewModel.recommendations.isEmpty {
            ErrorView(
                message: error,
                detail: "Could not load growth recommendations.",
                isFullScreen: true,
                retryAction: {
                    Task { await viewModel.loadRecommendations() }
                }
            )
        } else {
            scrollContent
        }
    }

    // MARK: Main Scroll Content

    private var scrollContent: some View {
        ScrollView {
            VStack(spacing: AlgoTheme.Spacing.xl) {
                // Recommendations Section
                recommendationsSection

                // History Section
                historySection
            }
            .padding(AlgoTheme.Spacing.md)
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: Recommendations Section

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            sectionHeader(title: "Recommendations", icon: "sparkles")

            if viewModel.recommendations.isEmpty {
                emptyRecommendationsCard
            } else {
                ForEach(viewModel.recommendations) { recommendation in
                    RecommendationCard(
                        recommendation: recommendation,
                        isProcessing: viewModel.processingIds.contains(recommendation.id),
                        onAccept: { id in
                            Task { await viewModel.acceptRecommendation(id) }
                        },
                        onDismiss: { id in
                            Task { await viewModel.dismissRecommendation(id) }
                        }
                    )
                }
            }
        }
    }

    // MARK: History Section

    private var historySection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            sectionHeader(title: "Execution History", icon: "clock.arrow.circlepath")

            NavigationLink {
                ExecutionHistoryView(executions: viewModel.executionHistory)
                    .task {
                        await viewModel.loadHistory()
                    }
            } label: {
                HStack(spacing: AlgoTheme.Spacing.sm) {
                    Image(systemName: "list.bullet.rectangle")
                        .font(.system(size: 18))
                        .foregroundStyle(AlgoTheme.Colors.primary)
                        .frame(width: 32, height: 32)
                        .background(AlgoTheme.Colors.primary.opacity(0.1))
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxxs) {
                        Text("View All Executions")
                            .font(AlgoTypography.labelMedium)
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)

                        Text("\(viewModel.executionHistory.count) actions executed")
                            .font(AlgoTypography.caption)
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AlgoTheme.Colors.textTertiary)
                }
                .padding(AlgoTheme.Spacing.sm)
                .background(AlgoTheme.Colors.surface)
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
                .algoShadow(AlgoTheme.Shadow.sm)
            }
        }
    }

    // MARK: Empty Recommendations

    private var emptyRecommendationsCard: some View {
        VStack(spacing: AlgoTheme.Spacing.sm) {
            Image(systemName: "sparkles")
                .font(.system(size: 32))
                .foregroundStyle(AlgoTheme.Colors.primary.opacity(0.4))

            Text("No recommendations right now")
                .font(AlgoTypography.labelMedium)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)

            Text("Check back later for AI-generated growth insights.")
                .font(AlgoTypography.bodySmall)
                .foregroundStyle(AlgoTheme.Colors.textTertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(AlgoTheme.Spacing.xl)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .algoShadow(AlgoTheme.Shadow.sm)
    }

    // MARK: Shimmer Loading State

    private var shimmerContent: some View {
        ScrollView {
            VStack(spacing: AlgoTheme.Spacing.xl) {
                // Section header shimmer
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
                    ShimmerPlaceholder(width: 160, height: 18)

                    // Recommendation card shimmers
                    ForEach(0..<3, id: \.self) { _ in
                        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
                            HStack {
                                ShimmerPlaceholder(width: 28, height: 28)
                                ShimmerPlaceholder(width: 180, height: 16)
                                Spacer()
                                ShimmerPlaceholder(width: 50, height: 18)
                            }
                            ShimmerPlaceholder(height: 40)
                            HStack {
                                ShimmerPlaceholder(width: 120, height: 20)
                                Spacer()
                            }
                        }
                        .padding(AlgoTheme.Spacing.md)
                        .background(AlgoTheme.Colors.surface)
                        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
                        .algoShadow(AlgoTheme.Shadow.sm)
                    }
                }

                // History section shimmer
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
                    ShimmerPlaceholder(width: 160, height: 18)
                    ShimmerPlaceholder(height: 56)
                }
            }
            .padding(AlgoTheme.Spacing.md)
        }
    }

    // MARK: Section Header

    private func sectionHeader(title: String, icon: String) -> some View {
        HStack(spacing: AlgoTheme.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AlgoTheme.Colors.primary)

            Text(title)
                .font(AlgoTypography.headline)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)
        }
    }

    // MARK: Toolbar

    private var safetyStatusLabel: some View {
        Group {
            if viewModel.isRefreshing {
                ProgressView()
                    .controlSize(.small)
            } else if let safety = viewModel.safetyStatus {
                HStack(spacing: AlgoTheme.Spacing.xxxs) {
                    Image(systemName: "shield.checkered")
                        .font(.system(size: 12))

                    Text("\(safety.limits.maxActionsPerDay - safety.dailyUsed) left")
                        .font(AlgoTypography.caption)
                }
                .foregroundStyle(AlgoTheme.Colors.textTertiary)
            }
        }
    }
}

// MARK: - Preview

#Preview("Growth") {
    GrowthView(service: PreviewGrowthService())
        .environmentObject(AppRouter())
}

// MARK: - Preview Service

/// Mock service for SwiftUI previews.
private final class PreviewGrowthService: GrowthServiceProtocol {

    func getRecommendations(limit: Int) async throws -> RecommendationsResponse {
        RecommendationsResponse(
            recommendations: [
                Recommendation(
                    id: "rec_001",
                    type: "schedule_post",
                    title: "Schedule Instagram post for peak engagement",
                    description: "Your audience is most active between 6-8 PM. Schedule your product launch announcement for tomorrow at 7 PM.",
                    confidence: 0.87,
                    impact: "high",
                    category: "growth",
                    actionable: true,
                    action: RecommendationAction(tool: "schedule_social_post", params: nil),
                    status: "pending",
                    createdAt: "2026-03-01T10:00:00Z",
                    expiresAt: "2026-03-02T10:00:00Z"
                ),
                Recommendation(
                    id: "rec_002",
                    type: "follow_up_lead",
                    title: "Follow up with hot lead Sarah Johnson",
                    description: "Sarah from TechCorp has been inactive for 3 days. A personalized follow-up could re-engage this high-value lead.",
                    confidence: 0.72,
                    impact: "medium",
                    category: "opportunity",
                    actionable: true,
                    action: RecommendationAction(tool: "send_followup", params: ["lead_id": "lead_001"]),
                    status: "pending",
                    createdAt: "2026-03-01T09:00:00Z",
                    expiresAt: "2026-03-02T09:00:00Z"
                ),
                Recommendation(
                    id: "rec_003",
                    type: "budget_alert",
                    title: "Review campaign budget allocation",
                    description: "Your Spring Sale campaign is spending 40% faster than projected. Consider adjusting the daily budget cap.",
                    confidence: 0.65,
                    impact: "low",
                    category: "risk",
                    actionable: false,
                    action: nil,
                    status: "pending",
                    createdAt: "2026-03-01T08:00:00Z",
                    expiresAt: "2026-03-03T08:00:00Z"
                )
            ],
            total: 3
        )
    }

    func acceptRecommendation(id: String) async throws -> AcceptResponse {
        AcceptResponse(confirmationId: "conf_\(id)", status: "accepted")
    }

    func dismissRecommendation(id: String) async throws -> DismissResponse {
        DismissResponse(status: "dismissed")
    }

    func getExecutionHistory(limit: Int) async throws -> ExecutionHistoryResponse {
        ExecutionHistoryResponse(
            executions: [
                ExecutionEntry(
                    id: "exec_001",
                    recommendationId: "rec_prev_001",
                    actionType: "schedule_social_post",
                    beforeState: nil,
                    afterState: nil,
                    result: "success",
                    error: nil,
                    executedAt: "2026-03-01T14:30:00Z"
                ),
                ExecutionEntry(
                    id: "exec_002",
                    recommendationId: "rec_prev_002",
                    actionType: "send_followup",
                    beforeState: nil,
                    afterState: nil,
                    result: "failed",
                    error: "Lead contact info missing",
                    executedAt: "2026-03-01T13:15:00Z"
                )
            ]
        )
    }

    func getSafetyStatus() async throws -> SafetyStatus {
        SafetyStatus(
            hourlyUsed: 2,
            dailyUsed: 5,
            limits: SafetyLimits(
                maxActionsPerHour: 5,
                maxActionsPerDay: 20,
                requireConfirmation: true
            )
        )
    }
}
