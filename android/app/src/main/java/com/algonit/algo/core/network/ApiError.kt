package com.algonit.algo.core.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Sealed class representing all possible API error types.
 * Provides user-friendly messages and HTTP status code mapping.
 */
sealed class ApiError {
    data object NetworkError : ApiError()
    data object Unauthorized : ApiError()
    data object Forbidden : ApiError()
    data object NotFound : ApiError()
    data class RateLimited(val retryAfterSeconds: Int) : ApiError()
    data class ServerError(val code: Int, val message: String) : ApiError()
    data object DecodingError : ApiError()
    data class TokenBudgetExhausted(val resetInSeconds: Long) : ApiError()
    data class Unknown(val message: String) : ApiError()

    fun toUserMessage(): String = when (this) {
        is NetworkError -> "No internet connection. Please check your network and try again."
        is Unauthorized -> "Your session has expired. Please log in again."
        is Forbidden -> "You don't have permission to perform this action."
        is NotFound -> "The requested resource was not found."
        is RateLimited -> "Too many requests. Please wait $retryAfterSeconds seconds and try again."
        is ServerError -> "Something went wrong on our end. Please try again later."
        is DecodingError -> "We received an unexpected response. Please try again."
        is TokenBudgetExhausted -> "Your AI usage limit has been reached. It resets in ${formatResetTime(resetInSeconds)}."
        is Unknown -> message.ifBlank { "An unexpected error occurred. Please try again." }
    }

    companion object {
        fun fromHttpStatus(status: Int, body: String? = null, retryAfter: Int? = null): ApiError =
            when (status) {
                401 -> Unauthorized
                403 -> Forbidden
                404 -> NotFound
                429 -> RateLimited(retryAfterSeconds = retryAfter ?: 60)
                in 500..599 -> ServerError(status, body ?: "Internal server error")
                else -> Unknown("HTTP $status: ${body ?: "Unknown error"}")
            }

        private fun formatResetTime(seconds: Long): String = when {
            seconds < 60 -> "$seconds seconds"
            seconds < 3600 -> "${seconds / 60} minutes"
            else -> "${seconds / 3600} hours"
        }
    }
}

/**
 * Server error response format matching the API contract.
 */
@Serializable
data class ApiErrorResponse(
    val error: ApiErrorBody,
    @SerialName("request_id") val requestId: String? = null,
    val timestamp: String? = null
)

@Serializable
data class ApiErrorBody(
    val code: String,
    val message: String,
    val details: Map<String, String>? = null
)

/**
 * Exception wrapping an API error for use in the network layer.
 */
class ApiException(
    val statusCode: Int,
    val errorBody: ApiErrorBody,
    val retryAfter: Int? = null
) : Exception(errorBody.message)

/**
 * Maps an [ApiException] to an [ApiError] sealed class instance.
 */
fun ApiException.toApiError(): ApiError {
    return when (errorBody.code) {
        "TOKEN_BUDGET_EXHAUSTED" -> {
            val resetIn = errorBody.details?.get("reset_in_seconds")?.toLongOrNull() ?: 3600
            ApiError.TokenBudgetExhausted(resetIn)
        }
        else -> ApiError.fromHttpStatus(statusCode, errorBody.message, retryAfter)
    }
}

/**
 * Maps any [Throwable] to an [ApiError] for uniform error handling.
 */
fun Throwable.toApiError(): ApiError = when (this) {
    is ApiException -> this.toApiError()
    is java.net.UnknownHostException -> ApiError.NetworkError
    is java.net.SocketTimeoutException -> ApiError.NetworkError
    is java.io.IOException -> ApiError.NetworkError
    is kotlinx.serialization.SerializationException -> ApiError.DecodingError
    else -> ApiError.Unknown(message ?: "An unexpected error occurred")
}
