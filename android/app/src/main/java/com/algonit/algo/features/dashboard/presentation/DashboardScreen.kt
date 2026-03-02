package com.algonit.algo.features.dashboard.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.algonit.algo.features.dashboard.data.model.DashboardMetrics
import com.algonit.algo.features.dashboard.presentation.components.AlertCard
import com.algonit.algo.features.dashboard.presentation.components.MetricTile
import com.algonit.algo.features.dashboard.presentation.components.QuickActionsGrid
import com.algonit.algo.features.dashboard.presentation.components.TrendDirection
import com.algonit.algo.ui.components.ErrorCard
import com.algonit.algo.ui.components.FullScreenErrorView
import com.algonit.algo.ui.theme.AlgoGreen
import com.algonit.algo.ui.theme.AlgoOrange
import com.algonit.algo.ui.theme.AlgoPurple
import com.algonit.algo.ui.theme.AlgoRed
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onNavigateToChat: () -> Unit = {},
    onNavigateToNotifications: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text(
                    text = "Dashboard",
                    style = MaterialTheme.typography.headlineSmall
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        )

        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                uiState.isLoading && uiState.metrics == null -> {
                    ShimmerDashboard()
                }

                uiState.error != null && uiState.metrics == null -> {
                    FullScreenErrorView(
                        message = uiState.error ?: "Unknown error",
                        onRetry = viewModel::loadDashboard
                    )
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Error banner (non-blocking)
                        uiState.error?.let { error ->
                            item(key = "error") {
                                ErrorCard(
                                    message = error,
                                    onRetry = viewModel::refresh
                                )
                            }
                        }

                        // Metrics grid (2 columns)
                        uiState.metrics?.let { metrics ->
                            item(key = "metrics_header") {
                                SectionHeader(title = "Overview")
                            }

                            item(key = "metrics_grid") {
                                MetricsGrid(metrics = metrics)
                            }
                        }

                        // Quick actions
                        item(key = "quick_actions_header") {
                            SectionHeader(title = "Quick Actions")
                        }

                        item(key = "quick_actions") {
                            QuickActionsGrid(
                                onNewChat = onNavigateToChat,
                                onViewLeads = onNavigateToChat,
                                onViewCampaigns = onNavigateToChat,
                                onViewCredits = onNavigateToChat
                            )
                        }

                        // Alerts
                        if (uiState.alerts.isNotEmpty()) {
                            item(key = "alerts_header") {
                                SectionHeader(title = "Recent Alerts")
                            }

                            items(
                                items = uiState.alerts,
                                key = { it.id }
                            ) { alert ->
                                AlertCard(
                                    alert = alert,
                                    onActionClick = { /* Navigate based on action */ }
                                )
                            }
                        }

                        // Updated at
                        uiState.updatedAt?.let { timestamp ->
                            item(key = "updated_at") {
                                Text(
                                    text = "Last updated: ${formatUpdatedAt(timestamp)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(top = 8.dp)
                                )
                            }
                        }

                        // Bottom spacing for navigation bar
                        item(key = "bottom_spacer") {
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = modifier
    )
}

@Composable
private fun MetricsGrid(metrics: DashboardMetrics) {
    val currencyFormat = NumberFormat.getCurrencyInstance(Locale.US)
    val numberFormat = NumberFormat.getNumberInstance(Locale.US)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Row 1
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricTile(
                title = "Total Leads",
                value = numberFormat.format(metrics.totalLeads),
                icon = Icons.Default.Group,
                modifier = Modifier.weight(1f),
                trend = TrendDirection.Up,
                trendLabel = "+12%"
            )
            MetricTile(
                title = "Hot Leads",
                value = metrics.hotLeads.toString(),
                icon = Icons.Default.LocalFireDepartment,
                iconTint = AlgoRed,
                modifier = Modifier.weight(1f),
                trend = TrendDirection.Up,
                trendLabel = "+2"
            )
        }

        // Row 2
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricTile(
                title = "Active Campaigns",
                value = metrics.activeCampaigns.toString(),
                icon = Icons.Default.Campaign,
                iconTint = AlgoPurple,
                modifier = Modifier.weight(1f)
            )
            MetricTile(
                title = "Engagement",
                value = numberFormat.format(metrics.totalEngagement),
                icon = Icons.Default.ThumbUp,
                iconTint = AlgoGreen,
                modifier = Modifier.weight(1f),
                trend = TrendDirection.Up,
                trendLabel = "+8%"
            )
        }

        // Row 3
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricTile(
                title = "Revenue Today",
                value = currencyFormat.format(metrics.revenueToday),
                icon = Icons.Default.AttachMoney,
                iconTint = AlgoGreen,
                modifier = Modifier.weight(1f),
                trend = TrendDirection.Up,
                trendLabel = "+15%"
            )
            MetricTile(
                title = "Pipeline",
                value = currencyFormat.format(metrics.pipelineValue),
                icon = Icons.Default.TrendingUp,
                modifier = Modifier.weight(1f)
            )
        }

        // Row 4
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MetricTile(
                title = "AI Credits",
                value = "${numberFormat.format(metrics.aiCreditsRemaining)}/${numberFormat.format(metrics.aiCreditsTotal)}",
                icon = Icons.Default.CreditCard,
                iconTint = AlgoOrange,
                modifier = Modifier.weight(1f),
                trend = if (metrics.aiCreditsRemaining < metrics.aiCreditsTotal * 0.2)
                    TrendDirection.Down else TrendDirection.Neutral,
                trendLabel = if (metrics.aiCreditsRemaining < metrics.aiCreditsTotal * 0.2)
                    "Low" else null
            )
            MetricTile(
                title = "Pending Follow-ups",
                value = metrics.pendingFollowups.toString(),
                icon = Icons.Default.Schedule,
                iconTint = AlgoOrange,
                modifier = Modifier.weight(1f),
                trend = if (metrics.pendingFollowups > 5)
                    TrendDirection.Down else TrendDirection.Neutral,
                trendLabel = if (metrics.pendingFollowups > 5) "Action needed" else null
            )
        }
    }
}

@Composable
private fun ShimmerDashboard() {
    val infiniteTransition = rememberInfiniteTransition(label = "shimmer")
    val shimmerTranslate by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )

    val shimmerBrush = Brush.linearGradient(
        colors = listOf(
            Color.LightGray.copy(alpha = 0.3f),
            Color.LightGray.copy(alpha = 0.1f),
            Color.LightGray.copy(alpha = 0.3f)
        ),
        start = Offset(shimmerTranslate - 200f, 0f),
        end = Offset(shimmerTranslate, 0f)
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Shimmer metric tiles (4 rows, 2 per row)
        items(4) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                repeat(2) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(100.dp)
                            .background(
                                brush = shimmerBrush,
                                shape = MaterialTheme.shapes.medium
                            )
                    )
                }
            }
        }

        // Shimmer quick actions
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                repeat(2) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(80.dp)
                            .background(
                                brush = shimmerBrush,
                                shape = MaterialTheme.shapes.medium
                            )
                    )
                }
            }
        }

        // Shimmer alert cards
        items(3) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .background(
                        brush = shimmerBrush,
                        shape = MaterialTheme.shapes.medium
                    )
            )
        }
    }
}

private fun formatUpdatedAt(iso: String): String {
    return try {
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
