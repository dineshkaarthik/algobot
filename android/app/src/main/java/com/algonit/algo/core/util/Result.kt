package com.algonit.algo.core.util

import com.algonit.algo.core.network.ApiError
import com.algonit.algo.core.network.toApiError

/**
 * A sealed class representing the result of an asynchronous operation.
 *
 * Used throughout the app for consistent error handling and loading state management.
 * Wraps success data, error information (via [ApiError]), and loading state.
 */
sealed class AppResult<out T> {
    data class Success<T>(val data: T) : AppResult<T>()
    data class Error(val error: ApiError, val message: String? = null) : AppResult<Nothing>()
    data object Loading : AppResult<Nothing>()

    val isSuccess: Boolean get() = this is Success
    val isError: Boolean get() = this is Error
    val isLoading: Boolean get() = this is Loading

    /**
     * Returns the success data, or null if this is not a Success.
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }

    /**
     * Returns the error, or null if this is not an Error.
     */
    fun errorOrNull(): ApiError? = when (this) {
        is Error -> error
        else -> null
    }

    /**
     * Transforms the success data using the given function.
     */
    fun <R> map(transform: (T) -> R): AppResult<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> Error(error, message)
        is Loading -> Loading
    }

    /**
     * Transforms the success data using a suspend function that returns another AppResult.
     */
    suspend fun <R> flatMap(transform: suspend (T) -> AppResult<R>): AppResult<R> = when (this) {
        is Success -> transform(data)
        is Error -> Error(error, message)
        is Loading -> Loading
    }

    /**
     * Performs the given action if this is a Success.
     */
    fun onSuccess(action: (T) -> Unit): AppResult<T> {
        if (this is Success) action(data)
        return this
    }

    /**
     * Performs the given action if this is an Error.
     */
    fun onError(action: (ApiError, String?) -> Unit): AppResult<T> {
        if (this is Error) action(error, message)
        return this
    }

    /**
     * Returns the success data or the given default value.
     */
    fun getOrDefault(default: @UnsafeVariance T): T = when (this) {
        is Success -> data
        else -> default
    }

    /**
     * Returns a user-friendly error message, or null if this is not an Error.
     */
    fun userMessage(): String? = when (this) {
        is Error -> message ?: error.toUserMessage()
        else -> null
    }
}

/**
 * Executes the given block and wraps the result in an [AppResult].
 * Catches exceptions and maps them to [AppResult.Error] using [toApiError].
 */
inline fun <T> safeCall(block: () -> T): AppResult<T> {
    return try {
        AppResult.Success(block())
    } catch (e: Exception) {
        AppResult.Error(
            error = e.toApiError(),
            message = e.message
        )
    }
}

/**
 * Executes the given suspend block and wraps the result in an [AppResult].
 */
suspend inline fun <T> safeSuspendCall(crossinline block: suspend () -> T): AppResult<T> {
    return try {
        AppResult.Success(block())
    } catch (e: Exception) {
        AppResult.Error(
            error = e.toApiError(),
            message = e.message
        )
    }
}
