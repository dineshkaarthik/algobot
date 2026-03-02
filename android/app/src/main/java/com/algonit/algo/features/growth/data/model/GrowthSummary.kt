package com.algonit.algo.features.growth.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class KpiChange(
    val metric: String,
    @SerialName("previous_value") val previousValue: Double,
    @SerialName("current_value") val currentValue: Double,
    @SerialName("change_percent") val changePercent: Double,
    val direction: String,
    val significance: String,
    val period: String
)

@Serializable
data class ChannelScore(
    val platform: String,
    @SerialName("overall_score") val overallScore: Double,
    val trend: String,
    val recommendation: String? = null
)

@Serializable
data class ExecutionEntry(
    val id: String,
    @SerialName("recommendation_id") val recommendationId: String,
    @SerialName("action_type") val actionType: String,
    val result: String,
    val error: String? = null,
    @SerialName("executed_at") val executedAt: String
)

@Serializable
data class ExecutionHistoryResponse(
    val executions: List<ExecutionEntry>
)

@Serializable
data class SafetyStatus(
    @SerialName("hourly_used") val hourlyUsed: Int,
    @SerialName("daily_used") val dailyUsed: Int,
    val limits: SafetyLimits
)

@Serializable
data class SafetyLimits(
    @SerialName("max_actions_per_hour") val maxActionsPerHour: Int,
    @SerialName("max_actions_per_day") val maxActionsPerDay: Int,
    @SerialName("require_confirmation") val requireConfirmation: Boolean
)
