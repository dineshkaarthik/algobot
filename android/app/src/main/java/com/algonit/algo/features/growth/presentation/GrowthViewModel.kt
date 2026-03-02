package com.algonit.algo.features.growth.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.growth.data.model.ExecutionEntry
import com.algonit.algo.features.growth.data.model.Recommendation
import com.algonit.algo.features.growth.data.model.SafetyStatus
import com.algonit.algo.features.growth.domain.repository.GrowthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class GrowthUiState(
    val recommendations: List<Recommendation> = emptyList(),
    val history: List<ExecutionEntry> = emptyList(),
    val safetyStatus: SafetyStatus? = null,
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class GrowthViewModel @Inject constructor(
    private val growthRepository: GrowthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(GrowthUiState())
    val uiState: StateFlow<GrowthUiState> = _uiState.asStateFlow()

    init {
        loadRecommendations()
    }

    fun loadRecommendations() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            when (val result = growthRepository.getRecommendations()) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(
                            recommendations = result.data.recommendations,
                            isLoading = false,
                            isRefreshing = false,
                            error = null
                        )
                    }
                    // Also load safety status in the background
                    loadSafetyStatus()
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = result.message ?: result.error.toUserMessage()
                        )
                    }
                }
                is AppResult.Loading -> { /* no-op */ }
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true, error = null) }

            when (val result = growthRepository.getRecommendations()) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(
                            recommendations = result.data.recommendations,
                            isRefreshing = false,
                            error = null
                        )
                    }
                    loadSafetyStatus()
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isRefreshing = false,
                            error = result.message ?: result.error.toUserMessage()
                        )
                    }
                }
                is AppResult.Loading -> { /* no-op */ }
            }
        }
    }

    fun acceptRecommendation(id: String) {
        viewModelScope.launch {
            when (val result = growthRepository.acceptRecommendation(id)) {
                is AppResult.Success -> {
                    // Update the recommendation status locally
                    _uiState.update { state ->
                        state.copy(
                            recommendations = state.recommendations.map { rec ->
                                if (rec.id == id) rec.copy(status = "accepted") else rec
                            }
                        )
                    }
                    // Refresh to get updated data
                    loadRecommendations()
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(error = result.message ?: "Failed to accept recommendation")
                    }
                }
                is AppResult.Loading -> { /* no-op */ }
            }
        }
    }

    fun dismissRecommendation(id: String) {
        viewModelScope.launch {
            when (val result = growthRepository.dismissRecommendation(id)) {
                is AppResult.Success -> {
                    // Remove the recommendation from the list
                    _uiState.update { state ->
                        state.copy(
                            recommendations = state.recommendations.filter { it.id != id }
                        )
                    }
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(error = result.message ?: "Failed to dismiss recommendation")
                    }
                }
                is AppResult.Loading -> { /* no-op */ }
            }
        }
    }

    fun loadHistory() {
        viewModelScope.launch {
            when (val result = growthRepository.getExecutionHistory()) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(history = result.data.executions)
                    }
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(error = result.message ?: "Failed to load history")
                    }
                }
                is AppResult.Loading -> { /* no-op */ }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun loadSafetyStatus() {
        viewModelScope.launch {
            when (val result = growthRepository.getSafetyStatus()) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(safetyStatus = result.data)
                    }
                }
                is AppResult.Error -> { /* Silent failure for safety status */ }
                is AppResult.Loading -> { /* no-op */ }
            }
        }
    }
}
