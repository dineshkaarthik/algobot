package com.algonit.algo.features.notifications.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.features.notifications.data.model.AppNotification
import com.algonit.algo.features.notifications.data.model.NotificationListResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class NotificationFilter {
    All,
    Unread
}

data class NotificationsUiState(
    val notifications: List<AppNotification> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val filter: NotificationFilter = NotificationFilter.All,
    val currentPage: Int = 1,
    val hasMore: Boolean = true,
    val isLoadingMore: Boolean = false
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val httpClient: HttpClient
) : ViewModel() {

    private val _uiState = MutableStateFlow(NotificationsUiState())
    val uiState: StateFlow<NotificationsUiState> = _uiState.asStateFlow()

    val unreadCount: StateFlow<Int> = MutableStateFlow(0).also { flow ->
        viewModelScope.launch {
            _uiState.collect { state ->
                (flow as MutableStateFlow).value = state.unreadCount
            }
        }
    }

    private val pageSize = 20

    init {
        loadNotifications()
    }

    fun loadNotifications() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, currentPage = 1) }

            try {
                val response = httpClient.get("/notifications") {
                    parameter("page", 1)
                    parameter("limit", pageSize)
                    if (_uiState.value.filter == NotificationFilter.Unread) {
                        parameter("unread_only", true)
                    }
                }.body<NotificationListResponse>()

                _uiState.update {
                    it.copy(
                        notifications = response.notifications,
                        unreadCount = response.unreadCount,
                        isLoading = false,
                        isRefreshing = false,
                        error = null,
                        currentPage = 1,
                        hasMore = response.notifications.size >= pageSize
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = e.message ?: "Failed to load notifications"
                    )
                }
            }
        }
    }

    fun loadMore() {
        val state = _uiState.value
        if (state.isLoadingMore || !state.hasMore) return

        viewModelScope.launch {
            val nextPage = state.currentPage + 1
            _uiState.update { it.copy(isLoadingMore = true) }

            try {
                val response = httpClient.get("/notifications") {
                    parameter("page", nextPage)
                    parameter("limit", pageSize)
                    if (state.filter == NotificationFilter.Unread) {
                        parameter("unread_only", true)
                    }
                }.body<NotificationListResponse>()

                _uiState.update {
                    it.copy(
                        notifications = it.notifications + response.notifications,
                        unreadCount = response.unreadCount,
                        isLoadingMore = false,
                        currentPage = nextPage,
                        hasMore = response.notifications.size >= pageSize
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoadingMore = false) }
            }
        }
    }

    fun refresh() {
        _uiState.update { it.copy(isRefreshing = true) }
        loadNotifications()
    }

    fun setFilter(filter: NotificationFilter) {
        if (_uiState.value.filter == filter) return
        _uiState.update { it.copy(filter = filter) }
        loadNotifications()
    }

    fun markRead(notificationId: String) {
        viewModelScope.launch {
            try {
                httpClient.post("/notifications/$notificationId/read")

                _uiState.update { state ->
                    val updated = state.notifications.map { notification ->
                        if (notification.id == notificationId) {
                            notification.copy(read = true)
                        } else {
                            notification
                        }
                    }
                    state.copy(
                        notifications = updated,
                        unreadCount = (state.unreadCount - 1).coerceAtLeast(0)
                    )
                }
            } catch (_: Exception) {
                // Silently fail - will sync on next refresh
            }
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            val unreadIds = _uiState.value.notifications
                .filter { !it.read }
                .map { it.id }

            // Optimistic update
            _uiState.update { state ->
                state.copy(
                    notifications = state.notifications.map { it.copy(read = true) },
                    unreadCount = 0
                )
            }

            // Send to server
            for (id in unreadIds) {
                try {
                    httpClient.post("/notifications/$id/read")
                } catch (_: Exception) {
                    // Continue with remaining
                }
            }
        }
    }
}
