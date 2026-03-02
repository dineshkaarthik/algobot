package com.algonit.algo.features.auth.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Request body for the POST /auth/login endpoint.
 */
@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("device_type") val deviceType: String = "android"
)

/**
 * Request body for the POST /auth/register endpoint.
 */
@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String,
    @SerialName("tenant_id") val tenantId: String,
    @SerialName("device_id") val deviceId: String,
    @SerialName("device_type") val deviceType: String = "android"
)

/**
 * Request body for the POST /auth/api-key endpoint.
 */
@Serializable
data class ApiKeyLoginRequest(
    @SerialName("api_key") val apiKey: String,
    @SerialName("device_id") val deviceId: String,
)

/**
 * Request body for the POST /auth/logout endpoint.
 */
@Serializable
data class LogoutRequest(
    @SerialName("device_id") val deviceId: String
)

/**
 * Request body for the POST /auth/refresh endpoint.
 */
@Serializable
data class RefreshRequest(
    @SerialName("refresh_token") val refreshToken: String
)

/**
 * Generic status response for endpoints that return { "status": "ok" }.
 */
@Serializable
data class StatusResponse(
    val status: String
)
