package com.algonit.algo.features.growth.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.growth.data.model.Recommendation
import com.algonit.algo.features.growth.data.model.SafetyStatus
import com.algonit.algo.ui.theme.AlgoGreen
import com.algonit.algo.ui.theme.AlgoOrange
import com.algonit.algo.ui.theme.AlgoPurple

@Composable
fun GrowthSummaryCard(
    recommendations: List<Recommendation>,
    safetyStatus: SafetyStatus?,
    modifier: Modifier = Modifier
) {
    val actionableCount = recommendations.count { it.actionable && it.status == "pending" }
    val highImpactCount = recommendations.count { it.impact.lowercase() == "high" }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = AlgoPurple.copy(alpha = 0.08f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Lightbulb,
                    contentDescription = null,
                    tint = AlgoPurple,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Growth Insights",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Summary headline
            Text(
                text = buildSummaryHeadline(
                    total = recommendations.size,
                    actionable = actionableCount,
                    highImpact = highImpactCount
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Urgent items indicator
            if (highImpactCount > 0) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = AlgoOrange,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "$highImpactCount high-impact item${if (highImpactCount > 1) "s" else ""} need${if (highImpactCount == 1) "s" else ""} attention",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium,
                        color = AlgoOrange
                    )
                }
            }

            // Safety status
            safetyStatus?.let { safety ->
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Actions today: ${safety.dailyUsed}/${safety.limits.maxActionsPerDay}",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (safety.dailyUsed >= safety.limits.maxActionsPerDay)
                            AlgoOrange else AlgoGreen
                    )
                    Text(
                        text = "This hour: ${safety.hourlyUsed}/${safety.limits.maxActionsPerHour}",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (safety.hourlyUsed >= safety.limits.maxActionsPerHour)
                            AlgoOrange else AlgoGreen
                    )
                }
            }
        }
    }
}

private fun buildSummaryHeadline(
    total: Int,
    actionable: Int,
    highImpact: Int
): String {
    return when {
        total == 0 -> "No recommendations right now. Check back later!"
        actionable == 0 -> "You have $total insight${if (total > 1) "s" else ""} to review."
        else -> "You have $actionable actionable recommendation${if (actionable > 1) "s" else ""} ready to execute."
    }
}
