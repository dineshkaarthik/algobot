package com.algonit.algo.features.dashboard.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.dashboard.data.model.AlertItem
import com.algonit.algo.ui.theme.SeverityHigh
import com.algonit.algo.ui.theme.SeverityHighBg
import com.algonit.algo.ui.theme.SeverityInfo
import com.algonit.algo.ui.theme.SeverityInfoBg
import com.algonit.algo.ui.theme.SeverityLow
import com.algonit.algo.ui.theme.SeverityLowBg
import com.algonit.algo.ui.theme.SeverityMedium
import com.algonit.algo.ui.theme.SeverityMediumBg

@Composable
fun AlertCard(
    alert: AlertItem,
    modifier: Modifier = Modifier,
    onActionClick: ((AlertItem) -> Unit)? = null
) {
    val severityColor = severityToColor(alert.severity)
    val severityBgColor = severityToBgColor(alert.severity)
    val alertIcon = alertTypeToIcon(alert.type)

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = severityBgColor.copy(alpha = 0.3f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
        ) {
            // Severity-colored left border
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .clip(MaterialTheme.shapes.small)
                    .background(severityColor)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Alert icon
                Icon(
                    imageVector = alertIcon,
                    contentDescription = alert.type,
                    tint = severityColor,
                    modifier = Modifier
                        .size(24.dp)
                        .padding(top = 2.dp)
                )

                // Content
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = alert.title,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = alert.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = formatTimestamp(alert.createdAt),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        if (alert.action != null && onActionClick != null) {
                            TextButton(
                                onClick = { onActionClick(alert) }
                            ) {
                                Text(
                                    text = formatActionLabel(alert.action.type),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = severityColor
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun severityToColor(severity: String): Color {
    return when (severity.lowercase()) {
        "high", "critical" -> SeverityHigh
        "medium", "warning" -> SeverityMedium
        "low" -> SeverityLow
        else -> SeverityInfo
    }
}

private fun severityToBgColor(severity: String): Color {
    return when (severity.lowercase()) {
        "high", "critical" -> SeverityHighBg
        "medium", "warning" -> SeverityMediumBg
        "low" -> SeverityLowBg
        else -> SeverityInfoBg
    }
}

private fun alertTypeToIcon(type: String): ImageVector {
    return when (type.lowercase()) {
        "hot_lead" -> Icons.Default.PersonAdd
        "campaign_drop" -> Icons.Default.TrendingDown
        "budget_alert" -> Icons.Default.Warning
        "credit_low" -> Icons.Default.CreditCard
        "followup_overdue" -> Icons.Default.Schedule
        "revenue_spike" -> Icons.Default.NotificationsActive
        else -> Icons.Default.Info
    }
}

private fun formatActionLabel(actionType: String): String {
    return when (actionType.uppercase()) {
        "VIEW_LEAD" -> "View Lead"
        "VIEW_CAMPAIGN" -> "View Campaign"
        "VIEW_REPORT" -> "View Report"
        "FOLLOW_UP" -> "Follow Up"
        else -> "View"
    }
}

private fun formatTimestamp(iso: String): String {
    return try {
        // Extract the time portion from ISO 8601 string
        val timePart = iso.substringAfter("T").substringBefore("Z").substringBefore("+")
        val parts = timePart.split(":")
        if (parts.size >= 2) {
            val hour = parts[0].toIntOrNull() ?: return iso
            val minute = parts[1]
            val amPm = if (hour >= 12) "PM" else "AM"
            val displayHour = when {
                hour == 0 -> 12
                hour > 12 -> hour - 12
                else -> hour
            }
            "$displayHour:$minute $amPm"
        } else {
            iso
        }
    } catch (_: Exception) {
        iso
    }
}
