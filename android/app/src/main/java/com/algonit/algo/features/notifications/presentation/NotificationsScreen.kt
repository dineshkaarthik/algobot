package com.algonit.algo.features.notifications.presentation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.algonit.algo.features.notifications.data.model.AppNotification
import com.algonit.algo.ui.components.FullScreenErrorView
import com.algonit.algo.ui.components.InlineLoadingView
import com.algonit.algo.ui.theme.SeverityHigh
import com.algonit.algo.ui.theme.SeverityHighBg
import com.algonit.algo.ui.theme.SeverityInfo
import com.algonit.algo.ui.theme.SeverityInfoBg
import com.algonit.algo.ui.theme.SeverityLow
import com.algonit.algo.ui.theme.SeverityLowBg
import com.algonit.algo.ui.theme.SeverityMedium
import com.algonit.algo.ui.theme.SeverityMediumBg

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel = hiltViewModel(),
    onNotificationClick: (AppNotification) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    // Detect when user scrolls near end for pagination
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisibleItem = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val totalItems = listState.layoutInfo.totalItemsCount
            lastVisibleItem >= totalItems - 3 && !uiState.isLoadingMore && uiState.hasMore
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            viewModel.loadMore()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Notifications",
                        style = MaterialTheme.typography.headlineSmall
                    )
                    if (uiState.unreadCount > 0) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "(${uiState.unreadCount})",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            },
            actions = {
                if (uiState.unreadCount > 0) {
                    IconButton(onClick = viewModel::markAllRead) {
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = "Mark all read"
                        )
                    }
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        )

        // Filter chips
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = uiState.filter == NotificationFilter.All,
                onClick = { viewModel.setFilter(NotificationFilter.All) },
                label = { Text("All") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
            FilterChip(
                selected = uiState.filter == NotificationFilter.Unread,
                onClick = { viewModel.setFilter(NotificationFilter.Unread) },
                label = {
                    Text(
                        text = if (uiState.unreadCount > 0) "Unread (${uiState.unreadCount})"
                        else "Unread"
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }

        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = viewModel::refresh,
            modifier = Modifier.fillMaxSize()
        ) {
            when {
                uiState.isLoading && uiState.notifications.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        InlineLoadingView(message = "Loading notifications...")
                    }
                }

                uiState.error != null && uiState.notifications.isEmpty() -> {
                    FullScreenErrorView(
                        message = uiState.error ?: "Unknown error",
                        onRetry = viewModel::loadNotifications
                    )
                }

                uiState.notifications.isEmpty() -> {
                    EmptyNotificationsView(filter = uiState.filter)
                }

                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(1.dp)
                    ) {
                        items(
                            items = uiState.notifications,
                            key = { it.id }
                        ) { notification ->
                            SwipeableNotificationItem(
                                notification = notification,
                                onMarkRead = { viewModel.markRead(notification.id) },
                                onClick = {
                                    if (!notification.read) {
                                        viewModel.markRead(notification.id)
                                    }
                                    onNotificationClick(notification)
                                }
                            )
                        }

                        if (uiState.isLoadingMore) {
                            item(key = "loading_more") {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    InlineLoadingView(message = "Loading more...")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeableNotificationItem(
    notification: AppNotification,
    onMarkRead: () -> Unit,
    onClick: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            if (dismissValue == SwipeToDismissBoxValue.EndToStart && !notification.read) {
                onMarkRead()
            }
            false // Don't actually dismiss, just mark as read
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            val color by animateColorAsState(
                targetValue = MaterialTheme.colorScheme.primaryContainer,
                label = "swipeColor"
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(color)
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    imageVector = Icons.Default.MarkEmailRead,
                    contentDescription = "Mark as read",
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        },
        enableDismissFromStartToEnd = false
    ) {
        NotificationItemCard(
            notification = notification,
            onClick = onClick
        )
    }
}

@Composable
private fun NotificationItemCard(
    notification: AppNotification,
    onClick: () -> Unit
) {
    val severityColor = when (notification.severity.lowercase()) {
        "high", "critical" -> SeverityHigh
        "medium", "warning" -> SeverityMedium
        "low" -> SeverityLow
        else -> SeverityInfo
    }

    val bgColor = if (!notification.read) {
        when (notification.severity.lowercase()) {
            "high", "critical" -> SeverityHighBg.copy(alpha = 0.15f)
            "medium", "warning" -> SeverityMediumBg.copy(alpha = 0.15f)
            "low" -> SeverityLowBg.copy(alpha = 0.15f)
            else -> SeverityInfoBg.copy(alpha = 0.15f)
        }
    } else {
        MaterialTheme.colorScheme.surface
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = bgColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        shape = MaterialTheme.shapes.extraSmall
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min)
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Unread indicator dot
            if (!notification.read) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .padding(top = 6.dp)
                        .clip(MaterialTheme.shapes.extraSmall)
                        .background(severityColor)
                )
            }

            // Icon
            Icon(
                imageVector = notificationTypeIcon(notification.type),
                contentDescription = notification.type,
                tint = severityColor,
                modifier = Modifier.size(24.dp)
            )

            // Content
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = if (!notification.read) FontWeight.SemiBold
                        else FontWeight.Normal
                    ),
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = notification.body,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = formatNotificationTime(notification.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun EmptyNotificationsView(filter: NotificationFilter) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.NotificationsOff,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(64.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = when (filter) {
                NotificationFilter.All -> "No notifications yet"
                NotificationFilter.Unread -> "All caught up!"
            },
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = when (filter) {
                NotificationFilter.All -> "You'll see alerts about leads, campaigns, and more here."
                NotificationFilter.Unread -> "You have no unread notifications."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun notificationTypeIcon(type: String): ImageVector {
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

private fun formatNotificationTime(iso: String): String {
    return try {
        val timePart = iso.substringAfter("T").substringBefore("Z").substringBefore("+")
        val datePart = iso.substringBefore("T")
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
            "$datePart $displayHour:$minute $amPm"
        } else {
            iso
        }
    } catch (_: Exception) {
        iso
    }
}
