// DashboardView.swift
// Algo
//
// Main dashboard screen displaying key metrics, active alerts,
// and quick action shortcuts. Supports pull-to-refresh and
// auto-refreshes every 5 minutes.

import SwiftUI

// MARK: - DashboardView

/// The primary dashboard screen showing business metrics at a glance.
///
/// Layout:
/// 1. Key Metrics grid (2-column)
/// 2. Active Alerts list
/// 3. Quick Actions grid (2x2)
struct DashboardView: View {

    // MARK: Properties

    @StateObject private var viewModel: DashboardViewModel
    @EnvironmentObject private var router: AppRouter

    // MARK: Initialization

    init(service: DashboardServiceProtocol) {
        self._viewModel = StateObject(wrappedValue: DashboardViewModel(service: service))
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Dashboard")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        lastUpdatedLabel
                    }
                }
        }
        .task {
            await viewModel.loadDashboard()
        }
        .onDisappear {
            viewModel.stopAutoRefresh()
        }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            shimmerContent
        } else if let error = viewModel.error, viewModel.metrics == nil {
            ErrorView(
                message: error,
                detail: "Could not load your dashboard data.",
                isFullScreen: true,
                retryAction: {
                    Task { await viewModel.loadDashboard() }
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
                // Key Metrics Section
                metricsSection

                // Active Alerts Section
                if !viewModel.alerts.isEmpty {
                    alertsSection
                }

                // Quick Actions Section
                quickActionsSection
            }
            .padding(AlgoTheme.Spacing.md)
        }
        .refreshable {
            await viewModel.refresh()
        }
    }

    // MARK: Metrics Section

    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            sectionHeader(title: "Key Metrics", icon: "chart.bar.fill")

            if let metrics = viewModel.metrics {
                LazyVGrid(
                    columns: [
                        GridItem(.flexible(), spacing: AlgoTheme.Spacing.sm),
                        GridItem(.flexible(), spacing: AlgoTheme.Spacing.sm)
                    ],
                    spacing: AlgoTheme.Spacing.sm
                ) {
                    MetricTile(
                        icon: "person.2.fill",
                        iconColor: Color.AlgoDefaults.blue,
                        title: "Total Leads",
                        value: "\(metrics.totalLeads)",
                        trend: .up,
                        trendLabel: "\(metrics.hotLeads) hot"
                    )

                    MetricTile(
                        icon: "flame.fill",
                        iconColor: Color.AlgoDefaults.orange,
                        title: "Hot Leads",
                        value: "\(metrics.hotLeads)",
                        trend: metrics.hotLeads > 0 ? .up : .neutral
                    )

                    MetricTile(
                        icon: "megaphone.fill",
                        iconColor: Color.AlgoDefaults.purple,
                        title: "Active Campaigns",
                        value: "\(metrics.activeCampaigns)"
                    )

                    MetricTile(
                        icon: "hand.thumbsup.fill",
                        iconColor: Color.AlgoDefaults.green,
                        title: "Engagement",
                        value: formattedNumber(metrics.totalEngagement)
                    )

                    MetricTile(
                        icon: "dollarsign.circle.fill",
                        iconColor: Color.AlgoDefaults.green,
                        title: "Revenue Today",
                        value: formattedCurrency(metrics.revenueToday)
                    )

                    MetricTile(
                        icon: "chart.line.uptrend.xyaxis",
                        iconColor: Color.AlgoDefaults.blue,
                        title: "Pipeline Value",
                        value: formattedCurrency(metrics.pipelineValue)
                    )

                    MetricTile(
                        icon: "cpu.fill",
                        iconColor: Color.AlgoDefaults.purple,
                        title: "AI Credits",
                        value: "\(metrics.aiCreditsRemaining)",
                        trendLabel: "of \(metrics.aiCreditsTotal)"
                    )

                    MetricTile(
                        icon: "clock.badge.exclamationmark.fill",
                        iconColor: Color.AlgoDefaults.red,
                        title: "Pending Follow-ups",
                        value: "\(metrics.pendingFollowups)",
                        trend: metrics.pendingFollowups > 0 ? .down : .neutral
                    )
                }
            }
        }
    }

    // MARK: Alerts Section

    private var alertsSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            sectionHeader(title: "Active Alerts", icon: "bell.badge.fill")

            ForEach(viewModel.alerts) { alert in
                AlertCard(alert: alert) { action in
                    handleAlertAction(action)
                }
            }
        }
    }

    // MARK: Quick Actions Section

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            sectionHeader(title: "Quick Actions", icon: "bolt.fill")

            QuickActionsGrid { destination in
                handleQuickAction(destination)
            }
        }
    }

    // MARK: Shimmer Loading State

    private var shimmerContent: some View {
        ScrollView {
            VStack(spacing: AlgoTheme.Spacing.xl) {
                // Metrics shimmer
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
                    ShimmerPlaceholder(width: 120, height: 18)

                    LazyVGrid(
                        columns: [
                            GridItem(.flexible(), spacing: AlgoTheme.Spacing.sm),
                            GridItem(.flexible(), spacing: AlgoTheme.Spacing.sm)
                        ],
                        spacing: AlgoTheme.Spacing.sm
                    ) {
                        ForEach(0..<6, id: \.self) { _ in
                            MetricTile.shimmerPlaceholder
                        }
                    }
                }

                // Alerts shimmer
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
                    ShimmerPlaceholder(width: 120, height: 18)

                    ForEach(0..<2, id: \.self) { _ in
                        ShimmerPlaceholder(height: 80)
                    }
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

    private var lastUpdatedLabel: some View {
        Group {
            if viewModel.isRefreshing {
                ProgressView()
                    .controlSize(.small)
            } else if let lastUpdated = viewModel.lastUpdated {
                Text("Updated \(formatRelativeTime(lastUpdated))")
                    .font(AlgoTypography.caption)
                    .foregroundStyle(AlgoTheme.Colors.textTertiary)
            }
        }
    }

    // MARK: Navigation Handlers

    private func handleAlertAction(_ action: AlertAction) {
        switch action.type {
        case "VIEW_LEAD":
            router.selectedTab = .chat
        case "VIEW_CAMPAIGN":
            router.selectedTab = .chat
        default:
            router.selectedTab = .chat
        }
    }

    private func handleQuickAction(_ destination: AppDestination) {
        switch destination {
        case .newChat:
            router.selectedTab = .chat
        case .leads:
            router.selectedTab = .chat
        case .campaigns:
            router.selectedTab = .chat
        case .credits:
            router.selectedTab = .settings
        }
    }

    // MARK: Formatting Helpers

    private func formattedNumber(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.groupingSeparator = ","
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func formattedCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = value >= 1000 ? 0 : 2
        return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
    }

    private func formatRelativeTime(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: isoString) else {
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: isoString) else {
                return isoString
            }
            return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: .now)
        }

        let relativeFormatter = RelativeDateTimeFormatter()
        relativeFormatter.unitsStyle = .abbreviated
        return relativeFormatter.localizedString(for: date, relativeTo: .now)
    }
}

// MARK: - Preview

#Preview("Dashboard") {
    DashboardView(service: PreviewDashboardService())
        .environmentObject(AppRouter())
}

// MARK: - Preview Service

/// Mock service for SwiftUI previews.
private final class PreviewDashboardService: DashboardServiceProtocol {

    func getSummary() async throws -> DashboardSummary {
        DashboardSummary(
            period: "today",
            metrics: DashboardMetrics(
                totalLeads: 47,
                hotLeads: 5,
                activeCampaigns: 12,
                totalEngagement: 8934,
                aiCreditsRemaining: 4500,
                aiCreditsTotal: 10000,
                revenueToday: 12450.00,
                pipelineValue: 89000.00,
                pendingFollowups: 8
            ),
            alerts: [
                AlertItem(
                    id: "alt_001",
                    type: "hot_lead",
                    severity: "high",
                    title: "New hot lead detected",
                    message: "Sarah Johnson from TechCorp scored 92/100",
                    createdAt: "2026-03-01T14:20:00Z",
                    action: AlertAction(type: "VIEW_LEAD", params: ["lead_id": "lead_001"])
                )
            ],
            updatedAt: "2026-03-01T15:30:00Z"
        )
    }

    func getAlerts() async throws -> [AlertItem] {
        try await getSummary().alerts
    }
}
