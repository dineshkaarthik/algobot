package com.algonit.algo.features.settings.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.features.auth.domain.repository.AuthRepository
import com.algonit.algo.ui.theme.DarkModeManager
import com.algonit.algo.ui.theme.ThemeMode
import dagger.hilt.android.lifecycle.HiltViewModel
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import javax.inject.Named
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import javax.inject.Inject

@Serializable
data class UserInfo(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    @SerialName("tenant_id") val tenantId: String,
    @SerialName("avatar_url") val avatarUrl: String? = null
)

@Serializable
data class AlertPreference(
    val enabled: Boolean = true,
    val push: Boolean = true,
    val email: Boolean = false,
    @SerialName("threshold_pct") val thresholdPct: Int? = null,
    val threshold: Int? = null
)

@Serializable
data class NotificationSettings(
    @SerialName("hot_lead") val hotLead: AlertPreference = AlertPreference(),
    @SerialName("campaign_drop") val campaignDrop: AlertPreference = AlertPreference(),
    @SerialName("budget_alert") val budgetAlert: AlertPreference = AlertPreference(
        thresholdPct = 80
    ),
    @SerialName("revenue_spike") val revenueSpike: AlertPreference = AlertPreference(),
    @SerialName("credit_low") val creditLow: AlertPreference = AlertPreference(
        threshold = 500
    ),
    @SerialName("followup_overdue") val followupOverdue: AlertPreference = AlertPreference()
)

data class SettingsUiState(
    val user: UserInfo? = null,
    val notificationSettings: NotificationSettings = NotificationSettings(),
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
    val saveSuccess: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @Named("api") private val httpClient: HttpClient,
    private val darkModeManager: DarkModeManager,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettings()
        observeThemeMode()
    }

    /**
     * Observes the persisted theme mode and updates the UI state reactively.
     */
    private fun observeThemeMode() {
        viewModelScope.launch {
            darkModeManager.themeMode.collect { mode ->
                _uiState.update { it.copy(themeMode = mode) }
            }
        }
    }

    /**
     * Sets the app theme mode and persists the preference.
     */
    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch {
            darkModeManager.setThemeMode(mode)
        }
    }

    fun loadSettings() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                // Load user info from stored token/profile
                // In production this would come from SecureStorage or a profile endpoint
                val notificationSettings = try {
                    httpClient.get("/notifications/settings").body<NotificationSettings>()
                } catch (_: Exception) {
                    NotificationSettings() // Use defaults if endpoint fails
                }

                _uiState.update {
                    it.copy(
                        notificationSettings = notificationSettings,
                        isLoading = false,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load settings"
                    )
                }
            }
        }
    }

    fun updateNotificationSettings(settings: NotificationSettings) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSaving = true, saveSuccess = false) }

            try {
                httpClient.put("/notifications/settings") {
                    contentType(ContentType.Application.Json)
                    setBody(settings)
                }

                _uiState.update {
                    it.copy(
                        notificationSettings = settings,
                        isSaving = false,
                        saveSuccess = true,
                        error = null
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSaving = false,
                        error = e.message ?: "Failed to save settings"
                    )
                }
            }
        }
    }

    fun setUser(user: UserInfo) {
        _uiState.update { it.copy(user = user) }
    }

    fun dismissSaveSuccess() {
        _uiState.update { it.copy(saveSuccess = false) }
    }

    fun dismissError() {
        _uiState.update { it.copy(error = null) }
    }

    fun logout() {
        viewModelScope.launch {
            // AuthRepository.logout() handles both the API call and clearing secure storage
            authRepository.logout()

            // Clear local settings state
            _uiState.update {
                SettingsUiState()
            }
        }
    }
}
