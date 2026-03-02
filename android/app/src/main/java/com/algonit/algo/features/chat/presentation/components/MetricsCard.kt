package com.algonit.algo.features.chat.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.chat.data.model.StructuredData
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

/**
 * Rich data display card for structured assistant responses.
 *
 * Renders different layouts based on the structured data type:
 * - Performance summaries: grid of platform metrics with optional chart
 * - Action confirmations: target details with status
 * - Action results: success/failure status with details
 *
 * @param structuredData The structured data payload from the assistant response.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MetricsCard(
    structuredData: StructuredData,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ),
        shape = MaterialTheme.shapes.medium
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header row with icon and type label
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = when {
                        structuredData.isPerformanceSummary -> Icons.Default.Analytics
                        structuredData.isActionResult && structuredData.status == "success" ->
                            Icons.Default.CheckCircle
                        structuredData.isActionResult && structuredData.status == "failed" ->
                            Icons.Default.Error
                        else -> Icons.Default.Info
                    },
                    contentDescription = null,
                    tint = when {
                        structuredData.isActionResult && structuredData.status == "success" ->
                            MaterialTheme.colorScheme.primary
                        structuredData.isActionResult && structuredData.status == "failed" ->
                            MaterialTheme.colorScheme.error
                        else -> MaterialTheme.colorScheme.primary
                    },
                    modifier = Modifier.size(20.dp)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Text(
                    text = formatTypeLabel(structuredData.type),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                // Time range badge
                structuredData.timeRange?.let { range ->
                    Spacer(modifier = Modifier.weight(1f))
                    Text(
                        text = range.replaceFirstChar { it.uppercase() },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Metrics grid
            structuredData.metrics?.let { metrics ->
                if (metrics.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        metrics.forEach { metricObj ->
                            MetricItem(metric = metricObj)
                        }
                    }

                    // Chart placeholder
                    if (structuredData.hasChart) {
                        Spacer(modifier = Modifier.height(12.dp))
                        ChartView(structuredData = structuredData)
                    }
                }
            }

            // Action result status
            if (structuredData.isActionResult) {
                Spacer(modifier = Modifier.height(8.dp))

                val statusColor = when (structuredData.status) {
                    "success" -> MaterialTheme.colorScheme.primary
                    "failed" -> MaterialTheme.colorScheme.error
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }

                Text(
                    text = "Status: ${structuredData.status?.replaceFirstChar { it.uppercase() } ?: "Unknown"}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = statusColor
                )
            }

            // Target info for action types
            structuredData.target?.let { target ->
                Spacer(modifier = Modifier.height(8.dp))
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
                )
                Spacer(modifier = Modifier.height(8.dp))

                target.entries.forEach { (key, value) ->
                    val displayKey = key.replace("_", " ")
                        .split(" ")
                        .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                    val displayValue = (value as? JsonPrimitive)?.content ?: value.toString()

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp)
                    ) {
                        Text(
                            text = "$displayKey:",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.width(120.dp)
                        )
                        Text(
                            text = displayValue,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }
    }
}

/**
 * A single metric item showing a platform or metric name with its values.
 */
@Composable
private fun MetricItem(
    metric: JsonObject,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        // Extract platform name or first key as header
        val platformKey = metric.entries.firstOrNull()
        val headerText = (platformKey?.value as? JsonPrimitive)?.content
            ?: platformKey?.key?.replaceFirstChar { it.uppercase() }
            ?: "Metric"

        Text(
            text = headerText.replaceFirstChar { it.uppercase() },
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Render numeric values
        metric.entries.drop(1).forEach { (key, value) ->
            val displayValue = (value as? JsonPrimitive)?.content ?: value.toString()
            val displayKey = key.replaceFirstChar { it.uppercase() }

            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "$displayKey:",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                )
                Text(
                    text = displayValue,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

/**
 * Converts a type identifier like "performance_summary" into "Performance Summary".
 */
private fun formatTypeLabel(type: String): String {
    return type
        .replace("_", " ")
        .split(" ")
        .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
}
