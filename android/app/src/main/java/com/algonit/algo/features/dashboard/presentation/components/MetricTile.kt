package com.algonit.algo.features.dashboard.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.algonit.algo.ui.theme.TrendDown
import com.algonit.algo.ui.theme.TrendNeutral
import com.algonit.algo.ui.theme.TrendUp

enum class TrendDirection {
    Up,
    Down,
    Neutral
}

@Composable
fun MetricTile(
    title: String,
    value: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    iconTint: Color = MaterialTheme.colorScheme.primary,
    trend: TrendDirection = TrendDirection.Neutral,
    trendLabel: String? = null
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = MaterialTheme.shapes.medium
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = iconTint,
                    modifier = Modifier.size(24.dp)
                )

                if (trend != TrendDirection.Neutral && trendLabel != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Icon(
                            imageVector = when (trend) {
                                TrendDirection.Up -> Icons.Default.TrendingUp
                                TrendDirection.Down -> Icons.Default.TrendingDown
                                TrendDirection.Neutral -> Icons.Default.TrendingUp
                            },
                            contentDescription = when (trend) {
                                TrendDirection.Up -> "Trending up"
                                TrendDirection.Down -> "Trending down"
                                TrendDirection.Neutral -> "No change"
                            },
                            tint = when (trend) {
                                TrendDirection.Up -> TrendUp
                                TrendDirection.Down -> TrendDown
                                TrendDirection.Neutral -> TrendNeutral
                            },
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = trendLabel,
                            style = MaterialTheme.typography.labelSmall,
                            color = when (trend) {
                                TrendDirection.Up -> TrendUp
                                TrendDirection.Down -> TrendDown
                                TrendDirection.Neutral -> TrendNeutral
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold
                ),
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
