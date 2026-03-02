package com.algonit.algo.features.chat.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.chat.data.model.Message
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Renders a single message as a chat bubble.
 *
 * - User messages: right-aligned with primary color background.
 * - Assistant messages: left-aligned with surface color background.
 * - Includes structured data card, confirmation card, and timestamp.
 *
 * @param message The message to render.
 * @param onConfirmAction Callback for confirmation card accept/reject.
 */
@Composable
fun MessageBubble(
    message: Message,
    onConfirmAction: ((confirmationId: String, confirmed: Boolean) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val screenWidth = LocalConfiguration.current.screenWidthDp.dp
    val maxBubbleWidth = screenWidth * 0.8f

    val alignment = if (message.isUser) Alignment.CenterEnd else Alignment.CenterStart

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = alignment
    ) {
        Column(
            modifier = Modifier.widthIn(max = maxBubbleWidth),
            horizontalAlignment = if (message.isUser) Alignment.End else Alignment.Start
        ) {
            // Message bubble
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (message.isUser) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                ),
                shape = MaterialTheme.shapes.large
            ) {
                Column(
                    modifier = Modifier.padding(12.dp)
                ) {
                    Text(
                        text = message.content,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (message.isUser) {
                            MaterialTheme.colorScheme.onPrimary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        }
                    )
                }
            }

            // Structured data card (metrics, charts, action details)
            if (message.hasStructuredData) {
                Spacer(modifier = Modifier.height(8.dp))

                message.structuredData?.let { data ->
                    when {
                        data.isPerformanceSummary && data.hasChart -> {
                            MetricsCard(structuredData = data)
                        }
                        data.isActionConfirmation || data.isActionResult -> {
                            MetricsCard(structuredData = data)
                        }
                        else -> {
                            MetricsCard(structuredData = data)
                        }
                    }
                }
            }

            // Confirmation card for actions requiring user approval
            if (message.needsConfirmation && onConfirmAction != null) {
                Spacer(modifier = Modifier.height(8.dp))

                ConfirmationCard(
                    message = message,
                    onConfirm = {
                        message.confirmationId?.let { id ->
                            onConfirmAction(id, true)
                        }
                    },
                    onCancel = {
                        message.confirmationId?.let { id ->
                            onConfirmAction(id, false)
                        }
                    }
                )
            }

            // Timestamp
            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = formatMessageTimestamp(message.timestamp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                textAlign = if (message.isUser) TextAlign.End else TextAlign.Start,
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        }
    }
}

/**
 * Formats an ISO timestamp for display next to a message.
 */
private fun formatMessageTimestamp(isoTimestamp: String): String {
    return try {
        val instant = Instant.parse(isoTimestamp)
        val formatter = DateTimeFormatter.ofPattern("h:mm a")
            .withZone(ZoneId.systemDefault())
        formatter.format(instant)
    } catch (_: Exception) {
        ""
    }
}
