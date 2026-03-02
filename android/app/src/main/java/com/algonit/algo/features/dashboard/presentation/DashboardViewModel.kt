package com.algonit.algo.features.dashboard.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.features.dashboard.data.model.AlertItem
import com.algonit.algo.features.dashboard.data.model.DashboardMetrics
import com.algonit.algo.features.dashboard.domain.repository.DashboardRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

private const val AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000L // 5 minutes

data class DashboardUiState(
    val metrics: DashboardMetrics? = null,
    val alerts: List<AlertItem> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val updatedAt: String? = null
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val repository: DashboardRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    val metrics: StateFlow<DashboardMetrics?> get() = MutableStateFlow(_uiState.value.metrics)
    val alerts: StateFlow<List<AlertItem>> get() = MutableStateFlow(_uiState.value.alerts)
    val isLoading: StateFlow<Boolean> get() = MutableStateFlow(_uiState.value.isLoading)
    val error: StateFlow<String?> get() = MutableStateFlow(_uiState.value.error)

    init {
        loadDashboard()
        startAutoRefresh()
    }

    fun loadDashboard() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            repository.getSummary()
                .onSuccess { summary ->
                    _uiState.update {
                        it.copy(
                            metrics = summary.metrics,
                            alerts = summary.alerts,
                            isLoading = false,
                            isRefreshing = false,
                            error = null,
                            updatedAt = summary.updatedAt
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = throwable.message ?: "Failed to load dashboard"
                        )
                    }
                }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true, error = null) }

            repository.getSummary()
                .onSuccess { summary ->
                    _uiState.update {
                        it.copy(
                            metrics = summary.metrics,
                            alerts = summary.alerts,
                            isRefreshing = false,
                            error = null,
                            updatedAt = summary.updatedAt
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.update {
                        it.copy(
                            isRefreshing = false,
                            error = throwable.message ?: "Failed to refresh dashboard"
                        )
                    }
                }
        }
    }

    fun dismissError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun startAutoRefresh() {
        viewModelScope.launch {
            while (isActive) {
                delay(AUTO_REFRESH_INTERVAL_MS)
                // Silent refresh - don't show loading indicator
                repository.getSummary()
                    .onSuccess { summary ->
                        _uiState.update {
                            it.copy(
                                metrics = summary.metrics,
                                alerts = summary.alerts,
                                updatedAt = summary.updatedAt
                            )
                        }
                    }
            }
        }
    }
}
