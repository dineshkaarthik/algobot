package com.algonit.algo.features.dashboard.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class DashboardSummary(
    val period: String,
    val metrics: DashboardMetrics,
    val alerts: List<AlertItem>,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class DashboardMetrics(
    @SerialName("total_leads") val totalLeads: Int,
    @SerialName("hot_leads") val hotLeads: Int,
    @SerialName("active_campaigns") val activeCampaigns: Int,
    @SerialName("total_engagement") val totalEngagement: Int,
    @SerialName("ai_credits_remaining") val aiCreditsRemaining: Int,
    @SerialName("ai_credits_total") val aiCreditsTotal: Int,
    @SerialName("revenue_today") val revenueToday: Double,
    @SerialName("pipeline_value") val pipelineValue: Double,
    @SerialName("pending_followups") val pendingFollowups: Int
)
