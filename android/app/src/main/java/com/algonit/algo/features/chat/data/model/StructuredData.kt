package com.algonit.algo.features.chat.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * Structured data attached to assistant responses for rich display.
 * Used to render metrics cards, charts, and action confirmation details.
 *
 * @property type The data type: "performance_summary", "action_confirmation", "action_result", etc.
 * @property metrics A list of metric data points for charts and metric cards.
 * @property chartType The chart visualization type: "bar", "line", "pie", etc.
 * @property timeRange The time period the data covers: "today", "week", "month".
 * @property action The action identifier for confirmation/result types (e.g., "PAUSE_CAMPAIGN").
 * @property status The status of an action result: "success", "failed", "pending".
 * @property target Additional target-specific details for the action, such as campaign info.
 */
@Serializable
data class StructuredData(
    val type: String,
    val metrics: List<JsonObject>? = null,
    @SerialName("chart_type") val chartType: String? = null,
    @SerialName("time_range") val timeRange: String? = null,
    val action: String? = null,
    val status: String? = null,
    val target: JsonObject? = null
) {
    /**
     * Whether this structured data represents a performance metrics summary.
     */
    val isPerformanceSummary: Boolean
        get() = type == "performance_summary"

    /**
     * Whether this structured data represents an action requiring user confirmation.
     */
    val isActionConfirmation: Boolean
        get() = type == "action_confirmation"

    /**
     * Whether this structured data represents the result of an executed action.
     */
    val isActionResult: Boolean
        get() = type == "action_result"

    /**
     * Whether this structured data has chart-renderable metrics.
     */
    val hasChart: Boolean
        get() = !metrics.isNullOrEmpty() && chartType != null
}
