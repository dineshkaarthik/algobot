package com.algonit.algo.core.network

import com.algonit.algo.core.storage.SecureStorage
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Handles JWT token injection and transparent token refresh.
 *
 * Uses a Mutex to ensure only one concurrent refresh operation occurs,
 * preventing token refresh races when multiple requests fail with 401 simultaneously.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val secureStorage: SecureStorage
) {
    private val refreshMutex = Mutex()

    @Volatile
    private var isRefreshing = false

    /**
     * Returns the current Bearer token for Authorization header injection.
     */
    fun getAuthorizationHeader(): String? {
        val token = secureStorage.getToken() ?: return null
        return "Bearer $token"
    }

    /**
     * Returns the tenant ID for X-Tenant-ID header injection.
     */
    fun getTenantId(): String? {
        return secureStorage.getTenantId()
    }

    /**
     * Returns true if a valid (non-expired) token is available.
     */
    fun hasValidToken(): Boolean {
        return secureStorage.getToken() != null && !secureStorage.isTokenExpired()
    }

    /**
     * Attempts to refresh the access token using the refresh token.
     * Thread-safe: only one refresh can occur at a time via Mutex.
     *
     * @param httpClient The HTTP client to use for the refresh request (avoids circular dependency)
     * @return true if the token was successfully refreshed, false otherwise
     */
    suspend fun refreshToken(httpClient: HttpClient): Boolean = refreshMutex.withLock {
        // Double-check: another coroutine may have already refreshed
        if (!secureStorage.isTokenExpired()) return@withLock true

        val refreshToken = secureStorage.getRefreshToken() ?: return@withLock false

        isRefreshing = true
        try {
            val response = httpClient.post("${ApiEndpoints.BASE_URL}${ApiEndpoints.REFRESH}") {
                contentType(ContentType.Application.Json)
                setBody(RefreshRequest(refreshToken))
            }

            if (response.status.isSuccess()) {
                val tokenResponse = response.body<RefreshResponse>()
                secureStorage.saveToken(tokenResponse.accessToken)
                secureStorage.saveRefreshToken(tokenResponse.refreshToken)
                secureStorage.saveTokenExpiry(
                    System.currentTimeMillis() + (tokenResponse.expiresIn * 1000L)
                )
                return@withLock true
            }

            // Refresh failed -- clear credentials to force re-login
            if (response.status.value == 401) {
                secureStorage.clearAll()
            }
            return@withLock false
        } catch (e: Exception) {
            return@withLock false
        } finally {
            isRefreshing = false
        }
    }

    /**
     * Clears all stored authentication data.
     */
    fun clearAuth() {
        secureStorage.clearAll()
    }
}

@Serializable
internal data class RefreshRequest(
    @SerialName("refresh_token") val refreshToken: String
)

@Serializable
internal data class RefreshResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Int
)
