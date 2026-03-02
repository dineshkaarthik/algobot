package com.algonit.algo.features.auth.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Full authentication token response from the login/register endpoints.
 * Contains both access and refresh tokens along with user profile data.
 */
@Serializable
data class AuthToken(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Int,
    @SerialName("token_type") val tokenType: String,
    val user: User
)

/**
 * Response from the token refresh endpoint.
 * Only returns a new access token; the refresh token remains unchanged.
 */
@Serializable
data class RefreshResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("expires_in") val expiresIn: Int
)
