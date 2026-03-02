// NotificationPreferencesView.swift
// Algo
//
// Notification preferences screen with toggles for each alert type.
// Each type has push and email sub-toggles, plus threshold sliders
// for budget_alert and credit_low.

import SwiftUI

// MARK: - NotificationPreferencesView

/// Allows the user to configure notification preferences for each alert type.
///
/// Features:
/// - Master toggle for each alert type (hot_lead, campaign_drop, etc.)
/// - Push and email sub-toggles per type
/// - Threshold slider for budget_alert (percentage)
/// - Threshold slider for credit_low (absolute count)
/// - Auto-saves on changes
struct NotificationPreferencesView: View {

    // MARK: Properties

    @ObservedObject var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss

    // MARK: Body

    var body: some View {
        List {
            hotLeadSection
            campaignDropSection
            budgetAlertSection
            revenueSpikeSection
            creditLowSection
            followupOverdueSection
        }
        .navigationTitle("Notification Preferences")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel.isSaving {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Button("Save") {
                        Task { await viewModel.updateNotificationSettings() }
                    }
                }
            }
        }
    }

    // MARK: Hot Lead Section

    private var hotLeadSection: some View {
        Section {
            Toggle(isOn: $viewModel.notificationSettings.hotLead.enabled) {
                Label {
                    Text("Hot Lead Alerts")
                } icon: {
                    Image(systemName: "flame.fill")
                        .foregroundStyle(Color.AlgoDefaults.red)
                }
            }

            if viewModel.notificationSettings.hotLead.enabled {
                subToggles(
                    push: $viewModel.notificationSettings.hotLead.push,
                    email: $viewModel.notificationSettings.hotLead.email
                )
            }
        } header: {
            Text("Hot Leads")
        } footer: {
            Text("Get notified when a lead reaches a high engagement score.")
        }
    }

    // MARK: Campaign Drop Section

    private var campaignDropSection: some View {
        Section {
            Toggle(isOn: $viewModel.notificationSettings.campaignDrop.enabled) {
                Label {
                    Text("Campaign Drop Alerts")
                } icon: {
                    Image(systemName: "chart.line.downtrend.xyaxis")
                        .foregroundStyle(Color.AlgoDefaults.orange)
                }
            }

            if viewModel.notificationSettings.campaignDrop.enabled {
                subToggles(
                    push: $viewModel.notificationSettings.campaignDrop.push,
                    email: $viewModel.notificationSettings.campaignDrop.email
                )
            }
        } header: {
            Text("Campaign Performance")
        } footer: {
            Text("Get notified when campaign engagement drops significantly.")
        }
    }

    // MARK: Budget Alert Section

    private var budgetAlertSection: some View {
        Section {
            Toggle(isOn: $viewModel.notificationSettings.budgetAlert.enabled) {
                Label {
                    Text("Budget Alerts")
                } icon: {
                    Image(systemName: "dollarsign.circle.fill")
                        .foregroundStyle(Color.AlgoDefaults.green)
                }
            }

            if viewModel.notificationSettings.budgetAlert.enabled {
                subToggles(
                    push: $viewModel.notificationSettings.budgetAlert.push,
                    email: $viewModel.notificationSettings.budgetAlert.email
                )

                // Threshold slider
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
                    HStack {
                        Text("Alert Threshold")
                            .font(AlgoTypography.bodySmall)
                        Spacer()
                        Text("\(viewModel.notificationSettings.budgetAlert.thresholdPct ?? 80)%")
                            .font(AlgoTypography.labelMedium)
                            .foregroundStyle(AlgoTheme.Colors.primary)
                    }

                    Slider(
                        value: Binding(
                            get: {
                                Double(viewModel.notificationSettings.budgetAlert.thresholdPct ?? 80)
                            },
                            set: {
                                viewModel.notificationSettings.budgetAlert.thresholdPct = Int($0)
                            }
                        ),
                        in: 50...95,
                        step: 5
                    )
                    .tint(AlgoTheme.Colors.primary)

                    Text("Alert when budget usage exceeds this percentage.")
                        .font(AlgoTypography.caption)
                        .foregroundStyle(AlgoTheme.Colors.textTertiary)
                }
            }
        } header: {
            Text("Budget")
        }
    }

    // MARK: Revenue Spike Section

    private var revenueSpikeSection: some View {
        Section {
            Toggle(isOn: $viewModel.notificationSettings.revenueSpike.enabled) {
                Label {
                    Text("Revenue Spike Alerts")
                } icon: {
                    Image(systemName: "arrow.up.right.circle.fill")
                        .foregroundStyle(Color.AlgoDefaults.green)
                }
            }

            if viewModel.notificationSettings.revenueSpike.enabled {
                subToggles(
                    push: $viewModel.notificationSettings.revenueSpike.push,
                    email: $viewModel.notificationSettings.revenueSpike.email
                )
            }
        } header: {
            Text("Revenue")
        } footer: {
            Text("Get notified about significant revenue increases.")
        }
    }

    // MARK: Credit Low Section

    private var creditLowSection: some View {
        Section {
            Toggle(isOn: $viewModel.notificationSettings.creditLow.enabled) {
                Label {
                    Text("Low Credit Alerts")
                } icon: {
                    Image(systemName: "creditcard.fill")
                        .foregroundStyle(Color.AlgoDefaults.purple)
                }
            }

            if viewModel.notificationSettings.creditLow.enabled {
                subToggles(
                    push: $viewModel.notificationSettings.creditLow.push,
                    email: $viewModel.notificationSettings.creditLow.email
                )

                // Threshold slider
                VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
                    HStack {
                        Text("Credit Threshold")
                            .font(AlgoTypography.bodySmall)
                        Spacer()
                        Text("\(viewModel.notificationSettings.creditLow.threshold ?? 500) credits")
                            .font(AlgoTypography.labelMedium)
                            .foregroundStyle(AlgoTheme.Colors.primary)
                    }

                    Slider(
                        value: Binding(
                            get: {
                                Double(viewModel.notificationSettings.creditLow.threshold ?? 500)
                            },
                            set: {
                                viewModel.notificationSettings.creditLow.threshold = Int($0)
                            }
                        ),
                        in: 100...2000,
                        step: 100
                    )
                    .tint(AlgoTheme.Colors.primary)

                    Text("Alert when remaining AI credits drop below this number.")
                        .font(AlgoTypography.caption)
                        .foregroundStyle(AlgoTheme.Colors.textTertiary)
                }
            }
        } header: {
            Text("AI Credits")
        }
    }

    // MARK: Follow-up Overdue Section

    private var followupOverdueSection: some View {
        Section {
            Toggle(isOn: $viewModel.notificationSettings.followupOverdue.enabled) {
                Label {
                    Text("Follow-up Overdue Alerts")
                } icon: {
                    Image(systemName: "clock.badge.exclamationmark.fill")
                        .foregroundStyle(Color.AlgoDefaults.red)
                }
            }

            if viewModel.notificationSettings.followupOverdue.enabled {
                subToggles(
                    push: $viewModel.notificationSettings.followupOverdue.push,
                    email: $viewModel.notificationSettings.followupOverdue.email
                )
            }
        } header: {
            Text("Follow-ups")
        } footer: {
            Text("Get notified when follow-ups are past their due date.")
        }
    }

    // MARK: Sub-Toggle Builder

    /// Creates push and email toggle rows for a notification preference.
    @ViewBuilder
    private func subToggles(push: Binding<Bool>, email: Binding<Bool>) -> some View {
        Toggle(isOn: push) {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                Image(systemName: "iphone")
                    .font(.system(size: 14))
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
                    .frame(width: 20)
                Text("Push Notification")
                    .font(AlgoTypography.bodySmall)
            }
        }
        .toggleStyle(.switch)
        .tint(AlgoTheme.Colors.primary)

        Toggle(isOn: email) {
            HStack(spacing: AlgoTheme.Spacing.xs) {
                Image(systemName: "envelope")
                    .font(.system(size: 14))
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
                    .frame(width: 20)
                Text("Email Notification")
                    .font(AlgoTypography.bodySmall)
            }
        }
        .toggleStyle(.switch)
        .tint(AlgoTheme.Colors.primary)
    }
}

// MARK: - Preview

#Preview("Notification Preferences") {
    NavigationStack {
        NotificationPreferencesView(
            viewModel: SettingsViewModel(
                tokenProvider: { "mock" },
                onLogout: {}
            )
        )
    }
}
