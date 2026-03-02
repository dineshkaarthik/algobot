package com.algonit.algo.features.chat.presentation.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.chat.data.model.StructuredData
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberBottomAxis
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberStartAxis
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberColumnCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberLineCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.core.cartesian.data.CartesianChartModelProducer
import com.patrykandpatrick.vico.core.cartesian.data.columnSeries
import com.patrykandpatrick.vico.core.cartesian.data.lineSeries
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Chart visualization using the Vico charting library.
 *
 * Renders bar or line charts from structured data metrics.
 * Automatically extracts numeric values from the metrics JSON objects
 * and maps them to chart data points.
 *
 * Themed with Material3 colors for consistent appearance.
 *
 * @param structuredData The structured data containing metrics and chart type.
 */
@Composable
fun ChartView(
    structuredData: StructuredData,
    modifier: Modifier = Modifier
) {
    val metrics = structuredData.metrics ?: return
    if (metrics.isEmpty()) return

    val primaryColor = MaterialTheme.colorScheme.primary
    val secondaryColor = MaterialTheme.colorScheme.secondary
    val tertiaryColor = MaterialTheme.colorScheme.tertiary

    // Extract numeric values from metrics
    val chartData = remember(metrics) {
        extractChartData(metrics)
    }

    if (chartData.labels.isEmpty() || chartData.values.isEmpty()) return

    val modelProducer = remember(chartData) {
        CartesianChartModelProducer.build {
            when (structuredData.chartType) {
                "line" -> {
                    lineSeries {
                        chartData.values.forEach { series ->
                            series(series)
                        }
                    }
                }
                else -> {
                    // Default to bar chart
                    columnSeries {
                        chartData.values.forEach { series ->
                            series(series)
                        }
                    }
                }
            }
        }
    }

    when (structuredData.chartType) {
        "line" -> {
            CartesianChartHost(
                chart = rememberCartesianChart(
                    rememberLineCartesianLayer(),
                    startAxis = rememberStartAxis(),
                    bottomAxis = rememberBottomAxis()
                ),
                modelProducer = modelProducer,
                modifier = modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .padding(top = 8.dp)
            )
        }
        else -> {
            // Bar chart (default)
            CartesianChartHost(
                chart = rememberCartesianChart(
                    rememberColumnCartesianLayer(),
                    startAxis = rememberStartAxis(),
                    bottomAxis = rememberBottomAxis()
                ),
                modelProducer = modelProducer,
                modifier = modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .padding(top = 8.dp)
            )
        }
    }
}

/**
 * Data extracted from JSON metrics for chart rendering.
 */
private data class ChartData(
    val labels: List<String>,
    val values: List<List<Number>>,
    val seriesNames: List<String>
)

/**
 * Extracts chart-compatible data from a list of JSON metric objects.
 *
 * Each JSON object represents one data point (e.g., one platform).
 * The first string field is used as the label, and all numeric fields
 * become separate data series.
 *
 * Example input:
 * ```json
 * [
 *   { "platform": "instagram", "likes": 1203, "comments": 89 },
 *   { "platform": "facebook",  "likes": 890,  "comments": 67 }
 * ]
 * ```
 * Produces labels: ["instagram", "facebook"]
 * Series "likes": [1203, 890], "comments": [89, 67]
 */
private fun extractChartData(
    metrics: List<kotlinx.serialization.json.JsonObject>
): ChartData {
    if (metrics.isEmpty()) return ChartData(emptyList(), emptyList(), emptyList())

    val labels = mutableListOf<String>()
    val seriesMap = mutableMapOf<String, MutableList<Number>>()

    // Determine which keys are labels (strings) vs values (numbers)
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

    // Initialize series
    numericKeys.forEach { key ->
        seriesMap[key] = mutableListOf()
    }

    // Extract data from each metric
    metrics.forEach { metricObj ->
        // Extract label
        val label = if (labelKey != null) {
            (metricObj[labelKey] as? JsonPrimitive)?.content ?: ""
        } else {
            "Item ${labels.size + 1}"
        }
        labels.add(label)

        // Extract numeric values
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
