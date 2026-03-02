package com.algonit.algo.features.chat.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.chat.data.model.StructuredData
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Simple chart visualization using native Compose.
 * Displays bar charts from structured data metrics.
 */
@Composable
fun ChartView(
    structuredData: StructuredData,
    modifier: Modifier = Modifier
) {
    val metrics = structuredData.metrics ?: return
    if (metrics.isEmpty()) return

    val chartData = remember(metrics) { extractChartData(metrics) }
    if (chartData.labels.isEmpty() || chartData.values.isEmpty()) return

    val primaryColor = MaterialTheme.colorScheme.primary
    val maxValue = chartData.values.firstOrNull()?.maxOfOrNull { it.toDouble() } ?: 1.0

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        chartData.labels.forEachIndexed { index, label ->
            val value = chartData.values.firstOrNull()?.getOrNull(index)?.toDouble() ?: 0.0
            val fraction = (value / maxValue).coerceIn(0.0, 1.0).toFloat()

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(0.3f)
                )
                Box(
                    modifier = Modifier
                        .weight(0.5f)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(primaryColor)
                    )
                }
                Text(
                    text = formatNumber(value),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(0.2f)
                )
            }
        }
    }
}

private fun formatNumber(value: Double): String {
    return if (value >= 1000) {
        String.format("%.1fK", value / 1000)
    } else if (value == value.toLong().toDouble()) {
        value.toLong().toString()
    } else {
        String.format("%.1f", value)
    }
}

private data class ChartData(
    val labels: List<String>,
    val values: List<List<Number>>,
    val seriesNames: List<String>
)

private fun extractChartData(
    metrics: List<kotlinx.serialization.json.JsonObject>
): ChartData {
    if (metrics.isEmpty()) return ChartData(emptyList(), emptyList(), emptyList())

    val labels = mutableListOf<String>()
    val seriesMap = mutableMapOf<String, MutableList<Number>>()

    val firstMetric = metrics.first()
    val labelKey = firstMetric.entries.firstOrNull { entry ->
        val prim = entry.value as? JsonPrimitive
        prim != null && !prim.isString.not() && prim.doubleOrNull == null
    }?.key

    val numericKeys = firstMetric.entries
        .filter { entry ->
            val prim = entry.value as? JsonPrimitive
            prim?.doubleOrNull != null
        }
        .map { it.key }

    if (numericKeys.isEmpty()) return ChartData(emptyList(), emptyList(), emptyList())

    numericKeys.forEach { key -> seriesMap[key] = mutableListOf() }

    metrics.forEach { metricObj ->
        val label = if (labelKey != null) {
            (metricObj[labelKey] as? JsonPrimitive)?.content ?: ""
        } else {
            "Item ${labels.size + 1}"
        }
        labels.add(label)

        numericKeys.forEach { key ->
            val value = (metricObj[key] as? JsonPrimitive)?.doubleOrNull ?: 0.0
            seriesMap[key]?.add(value)
        }
    }

    return ChartData(
        labels = labels,
        values = seriesMap.values.map { it.toList() },
        seriesNames = numericKeys
    )
}
