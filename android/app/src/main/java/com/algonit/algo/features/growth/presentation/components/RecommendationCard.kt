package com.algonit.algo.features.growth.presentation.components

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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.growth.data.model.Recommendation
import com.algonit.algo.ui.theme.AlgoGreen
import com.algonit.algo.ui.theme.AlgoOrange
import com.algonit.algo.ui.theme.AlgoRed

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RecommendationCard(
    recommendation: Recommendation,
    onAccept: (String) -> Unit,
    onDismiss: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Title row with confidence badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = recommendation.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                ConfidenceBadge(confidence = recommendation.confidence)
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Description
            Text(
                text = recommendation.description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Chips row
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                ImpactChip(impact = recommendation.impact)
                CategoryChip(category = recommendation.category)
            }

            // Action buttons for actionable recommendations
            if (recommendation.actionable && recommendation.status == "pending") {
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = { onDismiss(recommendation.id) },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Dismiss",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Dismiss")
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Button(
                        onClick = { onAccept(recommendation.id) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AlgoGreen
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Accept",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Accept")
                    }
                }
            }

            // Status indicator for non-pending recommendations
            if (recommendation.status != "pending") {
                Spacer(modifier = Modifier.height(8.dp))
                StatusLabel(status = recommendation.status)
            }
        }
    }
}

@Composable
private fun ConfidenceBadge(
    confidence: Double,
    modifier: Modifier = Modifier
) {
    val percent = (confidence * 100).toInt()
    val color = when {
        percent >= 80 -> AlgoGreen
        percent >= 60 -> AlgoOrange
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Card(
        colors = CardDefaults.cardColors(
            containerColor = color.copy(alpha = 0.15f)
        ),
        modifier = modifier
    ) {
        Text(
            text = "$percent%",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = color,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun ImpactChip(
    impact: String,
    modifier: Modifier = Modifier
) {
    val (color, label) = when (impact.lowercase()) {
        "high" -> AlgoRed to "High Impact"
        "medium" -> AlgoOrange to "Medium Impact"
        "low" -> AlgoGreen to "Low Impact"
        else -> MaterialTheme.colorScheme.onSurfaceVariant to impact.replaceFirstChar { it.uppercase() }
    }

    AssistChip(
        onClick = { },
        label = {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium
            )
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = color.copy(alpha = 0.1f),
            labelColor = color
        ),
        border = AssistChipDefaults.assistChipBorder(
            enabled = true,
            borderColor = color.copy(alpha = 0.3f)
        ),
        modifier = modifier
    )
}

@Composable
private fun CategoryChip(
    category: String,
    modifier: Modifier = Modifier
) {
    AssistChip(
        onClick = { },
        label = {
            Text(
                text = category.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall
            )
        },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            labelColor = MaterialTheme.colorScheme.onSecondaryContainer
        ),
        modifier = modifier
    )
}

@Composable
private fun StatusLabel(
    status: String,
    modifier: Modifier = Modifier
) {
    val (color, label) = when (status.lowercase()) {
        "accepted" -> AlgoGreen to "Accepted"
        "dismissed" -> Color.Gray to "Dismissed"
        "executed" -> AlgoGreen to "Executed"
        "failed" -> AlgoRed to "Failed"
        else -> MaterialTheme.colorScheme.onSurfaceVariant to status.replaceFirstChar { it.uppercase() }
    }

    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.Medium,
        color = color,
        modifier = modifier
    )
}
