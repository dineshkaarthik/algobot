package com.algonit.algo.features.auth.presentation

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.core.storage.SecureStorage
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.auth.data.BiometricAuthManager
import com.algonit.algo.features.auth.data.model.User
import com.algonit.algo.features.auth.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for authentication screens.
 */
data class AuthUiState(
    val isAuthenticated: Boolean = false,
    val isLoading: Boolean = false,
    val currentUser: User? = null,
    val error: String? = null,
    val isBiometricAvailable: Boolean = false,
    val isBiometricEnabled: Boolean = false,
    val isCheckingAuth: Boolean = true
)

/**
 * ViewModel managing authentication state and operations.
 * Supports email/password login, registration, biometric authentication,
 * and session restoration on app launch.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val secureStorage: SecureStorage,
    private val biometricAuthManager: BiometricAuthManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    // Convenience accessors for common state properties
    val isAuthenticated: StateFlow<Boolean>
        get() = MutableStateFlow(_uiState.value.isAuthenticated).also { flow ->
            viewModelScope.launch {
                _uiState.collect { state -> (flow as MutableStateFlow).value = state.isAuthenticated }
            }
        }

    init {
        checkBiometric()
        checkAuthOnLaunch()
    }

    /**
     * Checks biometric hardware availability and whether the user has enabled
     * biometric login, updating the UI state accordingly.
     */
    fun checkBiometric() {
        val available = biometricAuthManager.isBiometricAvailable
        val enabled = secureStorage.isBiometricEnabled()
        _uiState.update {
            it.copy(
                isBiometricAvailable = available,
                isBiometricEnabled = enabled
            )
        }
    }

    /**
     * Toggles biometric login on or off.
     * When enabling, requires that biometric hardware is available.
     */
    fun setBiometricEnabled(enabled: Boolean) {
        if (enabled && !biometricAuthManager.isBiometricAvailable) {
            _uiState.update { it.copy(error = "Biometric authentication is not available on this device") }
            return
        }
        secureStorage.setBiometricEnabled(enabled)
        _uiState.update { it.copy(isBiometricEnabled = enabled) }
    }

    /**
     * Performs biometric authentication using the coroutine-based BiometricAuthManager.
     * On success, restores the session from stored tokens.
     */
    fun authenticateWithBiometricManager(activity: FragmentActivity) {
        if (!secureStorage.isBiometricEnabled() || !secureStorage.hasTokens()) {
            _uiState.update { it.copy(error = "Biometric login not available") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            val success = biometricAuthManager.authenticate(activity)
            if (success) {
                val user = authRepository.getCurrentUser()
                if (user != null && authRepository.isAuthenticated()) {
                    _uiState.update {
                        it.copy(
                            isAuthenticated = true,
                            isLoading = false,
                            currentUser = user,
                            error = null
                        )
                    }
                } else {
                    // Tokens may be expired; attempt refresh
                    when (authRepository.refreshToken()) {
                        is AppResult.Success -> {
                            val refreshedUser = authRepository.getCurrentUser()
                            _uiState.update {
                                it.copy(
                                    isAuthenticated = true,
                                    isLoading = false,
                                    currentUser = refreshedUser,
                                    error = null
                                )
                            }
                        }
                        is AppResult.Error -> {
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    error = "Session expired. Please log in again."
                                )
                            }
                        }
                        else -> { }
                    }
                }
            } else {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    /**
     * Checks stored credentials on app launch to restore the previous session.
     * If tokens exist and are valid, the user is authenticated without re-login.
     */
    fun checkAuthOnLaunch() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCheckingAuth = true) }

            val isAuth = authRepository.isAuthenticated()
            val user = authRepository.getCurrentUser()

            if (isAuth && user != null) {
                _uiState.update {
                    it.copy(
                        isAuthenticated = true,
                        currentUser = user,
                        isCheckingAuth = false
                    )
                }
            } else if (secureStorage.hasTokens()) {
                // Tokens exist but may be expired; attempt refresh
                when (val result = authRepository.refreshToken()) {
                    is AppResult.Success -> {
                        val refreshedUser = authRepository.getCurrentUser()
                        _uiState.update {
                            it.copy(
                                isAuthenticated = true,
                                currentUser = refreshedUser,
                                isCheckingAuth = false
                            )
                        }
                    }
                    is AppResult.Error -> {
                        _uiState.update {
                            it.copy(
                                isAuthenticated = false,
                                isCheckingAuth = false
                            )
                        }
                    }
                    else -> { }
                }
            } else {
                _uiState.update {
                    it.copy(
                        isAuthenticated = false,
                        isCheckingAuth = false
                    )
                }
            }
        }
    }

    /**
     * Authenticates the user with email and password credentials.
     */
    fun login(email: String, password: String) {
        if (email.isBlank() || password.isBlank()) {
            _uiState.update { it.copy(error = "Email and password are required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            when (val result = authRepository.login(email, password)) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isAuthenticated = true,
                            isLoading = false,
                            currentUser = result.data,
                            error = null
                        )
                    }
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = result.error.toUserMessage()
                        )
                    }
                }
                else -> { }
            }
        }
    }

    /**
     * Creates a new account and authenticates the user.
     */
    fun register(email: String, password: String, name: String, tenantId: String) {
        if (email.isBlank() || password.isBlank() || name.isBlank()) {
            _uiState.update { it.copy(error = "All fields are required") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            when (val result = authRepository.register(email, password, name, tenantId)) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(
                            isAuthenticated = true,
                            isLoading = false,
                            currentUser = result.data,
                            error = null
                        )
                    }
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = result.error.toUserMessage()
                        )
                    }
                }
                else -> { }
            }
        }
    }

    /**
     * Logs the user out, clearing all session data.
     */
    fun logout() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            authRepository.logout()

            _uiState.update {
                AuthUiState(
                    isAuthenticated = false,
                    isLoading = false,
                    isCheckingAuth = false
                )
            }
        }
    }

    /**
     * Clears the current error message from the UI state.
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    /**
     * Checks if biometric authentication is available on the device.
     */
    fun checkBiometricAvailability(activity: FragmentActivity) {
        val biometricManager = BiometricManager.from(activity)
        val canAuthenticate = biometricManager.canAuthenticate(
            BIOMETRIC_STRONG or BIOMETRIC_WEAK
        )
        _uiState.update {
            it.copy(isBiometricAvailable = canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS)
        }
    }

    /**
     * Initiates biometric authentication to unlock a stored session.
     * Requires that biometric is enabled and that valid tokens exist in storage.
     */
    fun authenticateWithBiometric(activity: FragmentActivity) {
        if (!secureStorage.isBiometricEnabled() || !secureStorage.hasTokens()) {
            _uiState.update { it.copy(error = "Biometric login not available") }
            return
        }

        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                // Biometric verified -- restore session from stored tokens
                viewModelScope.launch {
                    val user = authRepository.getCurrentUser()
                    if (user != null && authRepository.isAuthenticated()) {
                        _uiState.update {
                            it.copy(
                                isAuthenticated = true,
                                currentUser = user,
                                error = null
                            )
                        }
                    } else {
                        // Tokens may be expired; attempt refresh
                        when (authRepository.refreshToken()) {
                            is AppResult.Success -> {
                                val refreshedUser = authRepository.getCurrentUser()
                                _uiState.update {
                                    it.copy(
                                        isAuthenticated = true,
                                        currentUser = refreshedUser,
                                        error = null
                                    )
                                }
                            }
                            is AppResult.Error -> {
                                _uiState.update {
                                    it.copy(error = "Session expired. Please log in again.")
                                }
                            }
                            else -> { }
                        }
                    }
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (errorCode != BiometricPrompt.ERROR_USER_CANCELED &&
                    errorCode != BiometricPrompt.ERROR_NEGATIVE_BUTTON
                ) {
                    _uiState.update { it.copy(error = errString.toString()) }
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // Individual attempt failed; BiometricPrompt handles retry UI
            }
        }

        val biometricPrompt = BiometricPrompt(activity, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Algo Authentication")
            .setSubtitle("Verify your identity to continue")
            .setNegativeButtonText("Use password")
            .setAllowedAuthenticators(BIOMETRIC_STRONG or BIOMETRIC_WEAK)
            .build()

        biometricPrompt.authenticate(promptInfo)
    }
}
