package com.algonit.algo.features.auth.data.repository

import android.content.Context
import android.provider.Settings
import com.algonit.algo.core.network.ApiClient
import com.algonit.algo.core.network.ApiEndpoints
import com.algonit.algo.core.network.ApiError
import com.algonit.algo.core.network.toApiError
import com.algonit.algo.core.storage.SecureStorage
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.auth.data.model.AuthToken
import com.algonit.algo.features.auth.data.model.LoginRequest
import com.algonit.algo.features.auth.data.model.LogoutRequest
import com.algonit.algo.features.auth.data.model.RefreshRequest
import com.algonit.algo.features.auth.data.model.RefreshResponse
import com.algonit.algo.features.auth.data.model.RegisterRequest
import com.algonit.algo.features.auth.data.model.StatusResponse
import com.algonit.algo.features.auth.data.model.User
import com.algonit.algo.features.auth.domain.repository.AuthRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Production implementation of [AuthRepository].
 * Handles authentication API calls, secure token storage,
 * and user session management using [ApiClient] and [SecureStorage].
 */
@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val apiClient: ApiClient,
    private val secureStorage: SecureStorage,
    private val json: Json,
    @ApplicationContext private val context: Context
) : AuthRepository {

    private val deviceId: String by lazy {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            ?: "unknown_device"
    }

    override suspend fun login(email: String, password: String): AppResult<User> {
        return try {
            val request = LoginRequest(
                email = email.trim(),
                password = password,
                deviceId = deviceId
            )

            val authToken: AuthToken = apiClient.postUnauthenticated(
                endpoint = ApiEndpoints.LOGIN,
                body = request
            )

            storeAuthData(authToken)
            AppResult.Success(authToken.user)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun register(
        email: String,
        password: String,
        name: String,
        tenantId: String
    ): AppResult<User> {
        return try {
            val request = RegisterRequest(
                email = email.trim(),
                password = password,
                name = name.trim(),
                tenantId = tenantId,
                deviceId = deviceId
            )

            val authToken: AuthToken = apiClient.postUnauthenticated(
                endpoint = ApiEndpoints.REGISTER,
                body = request
            )

            storeAuthData(authToken)
            AppResult.Success(authToken.user)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun logout(): AppResult<Unit> {
        return try {
            val request = LogoutRequest(deviceId = deviceId)

            apiClient.post<StatusResponse>(
                endpoint = ApiEndpoints.LOGOUT,
                body = request
            )

            clearAuthData()
            AppResult.Success(Unit)
        } catch (e: Exception) {
            // Clear local data even if server call fails
            clearAuthData()
            AppResult.Success(Unit)
        }
    }

    override suspend fun refreshToken(): AppResult<Unit> {
        return try {
            val refreshToken = secureStorage.getRefreshToken()
                ?: return AppResult.Error(ApiError.Unauthorized, "No refresh token available")

            val request = RefreshRequest(refreshToken = refreshToken)

            val response: RefreshResponse = apiClient.postUnauthenticated(
                endpoint = ApiEndpoints.REFRESH,
                body = request
            )

            secureStorage.saveToken(response.accessToken)
            secureStorage.saveTokenExpiry(response.expiresIn)

            AppResult.Success(Unit)
        } catch (e: Exception) {
            // If refresh fails, the session is invalid
            clearAuthData()
            AppResult.Error(e.toApiError())
        }
    }

    override fun isAuthenticated(): Boolean {
        return secureStorage.getToken() != null &&
                secureStorage.getRefreshToken() != null &&
                !secureStorage.isTokenExpired()
    }

    override fun getCurrentUser(): User? {
        val userJson = secureStorage.getUserJson() ?: return null
        return try {
            json.decodeFromString<User>(userJson)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Persists all auth-related data to secure storage after a successful
     * login or registration.
     */
    private fun storeAuthData(authToken: AuthToken) {
        secureStorage.saveToken(authToken.accessToken)
        secureStorage.saveRefreshToken(authToken.refreshToken)
        secureStorage.saveTokenExpiry(authToken.expiresIn)
        secureStorage.saveTenantId(authToken.user.tenantId)
        secureStorage.saveUserId(authToken.user.id)
        secureStorage.saveUserJson(json.encodeToString(User.serializer(), authToken.user))
    }

    /**
     * Clears all stored authentication data on logout or token invalidation.
     */
    private fun clearAuthData() {
        secureStorage.clearAll()
    }
}
