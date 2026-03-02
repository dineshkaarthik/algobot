package com.algonit.algo.features.auth.domain.repository

import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.auth.data.model.User

/**
 * Domain-layer contract for authentication operations.
 * Implementations handle HTTP calls, token persistence, and session management.
 */
interface AuthRepository {

    /**
     * Authenticates the user with email and password.
     * On success, tokens are stored securely and the user profile is returned.
     */
    suspend fun login(email: String, password: String): AppResult<User>

    /**
     * Creates a new user account and authenticates immediately.
     * On success, tokens are stored securely and the user profile is returned.
     */
    suspend fun register(
        email: String,
        password: String,
        name: String,
        tenantId: String
    ): AppResult<User>

    /**
     * Logs the user out, invalidating the current session on the server.
     * Clears all stored tokens and user data locally.
     */
    suspend fun logout(): AppResult<Unit>

    /**
     * Refreshes the access token using the stored refresh token.
     * Updates the stored access token on success.
     */
    suspend fun refreshToken(): AppResult<Unit>

    /**
     * Checks whether the user has valid stored authentication credentials.
     * Does not perform network validation; checks local token presence and expiry.
     */
    fun isAuthenticated(): Boolean

    /**
     * Returns the currently stored user profile, or null if not authenticated.
     */
    fun getCurrentUser(): User?
}
