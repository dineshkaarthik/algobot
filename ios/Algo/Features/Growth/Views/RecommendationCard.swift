// RecommendationCard.swift
// Algo
//
// Individual recommendation card displaying title, description,
// confidence/impact badges, category icon, and action buttons.

import SwiftUI

// MARK: - RecommendationCard

/// Displays a single AI-generated recommendation as a styled card.
///
/// Layout:
/// 1. Category icon + title + impact badge
/// 2. Description text
/// 3. Confidence badge
/// 4. Accept / Dismiss action buttons (for actionable items)
///
/// Usage:
/// ```swift
/// RecommendationCard(
///     recommendation: recommendation,
///     isProcessing: false,
///     onAccept: { id in await viewModel.acceptRecommendation(id) },
///     onDismiss: { id in await viewModel.dismissRecommendation(id) }
/// )
/// ```
struct RecommendationCard: View {

    // MARK: Properties

    /// The recommendation data to display.
    let recommendation: Recommendation

    /// Whether an accept/dismiss action is currently in progress.
    let isProcessing: Bool

    /// Closure called when the user taps "Accept".
    let onAccept: ((String) -> Void)?

    /// Closure called when the user taps "Dismiss".
    let onDismiss: ((String) -> Void)?

    // MARK: Initialization

    init(
        recommendation: Recommendation,
        isProcessing: Bool = false,
        onAccept: ((String) -> Void)? = nil,
        onDismiss: ((String) -> Void)? = nil
    ) {
        self.recommendation = recommendation
        self.isProcessing = isProcessing
        self.onAccept = onAccept
        self.onDismiss = onDismiss
    }

    // MARK: Body

    var body: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.sm) {
            // Header: category icon + title + impact badge
            headerRow

            // Description
            Text(recommendation.description)
                .font(AlgoTypography.bodySmall)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)
                .lineLimit(3)

            // Badges row: confidence + category
            badgesRow

            // Action buttons for pending actionable items
            if recommendation.actionable && recommendation.status == "pending" {
                actionButtons
            }
        }
        .padding(AlgoTheme.Spacing.md)
        .background(AlgoTheme.Colors.surface)
        .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.md))
        .algoShadow(AlgoTheme.Shadow.sm)
        .opacity(isProcessing ? 0.6 : 1.0)
        .animation(AlgoTheme.Animation.fast, value: isProcessing)
    }

    // MARK: Header Row

    private var headerRow: some View {
        HStack(spacing: AlgoTheme.Spacing.xs) {
            // Category icon
            Image(systemName: categoryIcon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(categoryColor)
                .frame(width: 28, height: 28)
                .background(categoryColor.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.xs))

            // Title
            Text(recommendation.title)
                .font(AlgoTypography.labelLarge)
                .foregroundStyle(AlgoTheme.Colors.textPrimary)
                .lineLimit(2)

            Spacer()

            // Impact badge
            impactBadge
        }
    }

    // MARK: Badges Row

    private var badgesRow: some View {
        HStack(spacing: AlgoTheme.Spacing.xs) {
            // Confidence badge
            confidenceBadge

            Spacer()

            // Category label
            Text(recommendation.category.capitalized)
                .font(AlgoTypography.labelSmall)
                .foregroundStyle(AlgoTheme.Colors.textTertiary)
        }
    }

    // MARK: Confidence Badge

    private var confidenceBadge: some View {
        HStack(spacing: AlgoTheme.Spacing.xxxs) {
            Image(systemName: "sparkle")
                .font(.system(size: 10, weight: .bold))

            Text("\(Int(recommendation.confidence * 100))% confidence")
                .font(AlgoTypography.labelSmall)
        }
        .foregroundStyle(AlgoTheme.Colors.primary)
        .padding(.horizontal, AlgoTheme.Spacing.xs)
        .padding(.vertical, AlgoTheme.Spacing.xxxs)
        .background(AlgoTheme.Colors.primary.opacity(0.08))
        .clipShape(Capsule())
    }

    // MARK: Impact Badge

    private var impactBadge: some View {
        Text(recommendation.impact.uppercased())
            .font(AlgoTypography.labelSmall)
            .foregroundStyle(impactColor)
            .padding(.horizontal, AlgoTheme.Spacing.xs)
            .padding(.vertical, AlgoTheme.Spacing.xxxs)
            .background(impactColor.opacity(0.12))
            .clipShape(Capsule())
    }

    // MARK: Action Buttons

    private var actionButtons: some View {
        HStack(spacing: AlgoTheme.Spacing.sm) {
            // Accept button
            Button {
                onAccept?(recommendation.id)
            } label: {
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    if isProcessing {
                        ProgressView()
                            .controlSize(.mini)
                            .tint(AlgoTheme.Colors.textOnPrimary)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                    }

                    Text("Accept")
                        .font(AlgoTypography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AlgoTheme.Spacing.xs)
                .foregroundStyle(AlgoTheme.Colors.textOnPrimary)
                .background(AlgoTheme.Colors.primary)
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
            }
            .disabled(isProcessing)

            // Dismiss button
            Button {
                onDismiss?(recommendation.id)
            } label: {
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))

                    Text("Dismiss")
                        .font(AlgoTypography.labelMedium)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AlgoTheme.Spacing.xs)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)
                .background(AlgoTheme.Colors.secondaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
            }
            .disabled(isProcessing)
        }
        .padding(.top, AlgoTheme.Spacing.xxs)
    }

    // MARK: Style Helpers

    /// SF Symbol name for the recommendation category.
    private var categoryIcon: String {
        switch recommendation.category.lowercased() {
        case "growth":        return "chart.line.uptrend.xyaxis"
        case "optimization":  return "slider.horizontal.3"
        case "risk":          return "exclamationmark.shield.fill"
        case "opportunity":   return "lightbulb.fill"
        default:              return "sparkles"
        }
    }

    /// Color for the recommendation category.
    private var categoryColor: Color {
        switch recommendation.category.lowercased() {
        case "growth":        return Color.AlgoDefaults.green
        case "optimization":  return Color.AlgoDefaults.blue
        case "risk":          return Color.AlgoDefaults.red
        case "opportunity":   return Color.AlgoDefaults.purple
        default:              return Color.AlgoDefaults.blue
        }
    }

    /// Color for the impact level badge.
    private var impactColor: Color {
        switch recommendation.impact.lowercased() {
        case "high":   return Color.AlgoDefaults.red
        case "medium": return Color.AlgoDefaults.orange
        case "low":    return Color.AlgoDefaults.green
        default:       return Color.AlgoDefaults.blue
        }
    }
}

// MARK: - Preview

#Preview("Recommendation Cards") {
    ScrollView {
        VStack(spacing: 12) {
            RecommendationCard(
                recommendation: Recommendation(
                    id: "rec_001",
                    type: "schedule_post",
                    title: "Schedule Instagram post for peak engagement",
                    description: "Your audience is most active between 6-8 PM. Schedule your product launch announcement for tomorrow at 7 PM to maximize reach.",
                    confidence: 0.87,
                    impact: "high",
                    category: "growth",
                    actionable: true,
                    action: RecommendationAction(tool: "schedule_social_post", params: nil),
                    status: "pending",
                    createdAt: "2026-03-01T10:00:00Z",
                    expiresAt: "2026-03-02T10:00:00Z"
                ),
                onAccept: { _ in },
                onDismiss: { _ in }
            )

            RecommendationCard(
                recommendation: Recommendation(
                    id: "rec_002",
                    type: "follow_up_lead",
                    title: "Follow up with hot lead",
                    description: "Sarah Johnson from TechCorp has been inactive for 3 days. A personalized follow-up could re-engage this high-value lead.",
                    confidence: 0.72,
                    impact: "medium",
                    category: "opportunity",
                    actionable: true,
                    action: RecommendationAction(tool: "send_followup", params: ["lead_id": "lead_001"]),
                    status: "pending",
                    createdAt: "2026-03-01T09:00:00Z",
                    expiresAt: "2026-03-02T09:00:00Z"
                ),
                onAccept: { _ in },
                onDismiss: { _ in }
            )

            RecommendationCard(
                recommendation: Recommendation(
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
            )
        }
        .padding()
    }
}
