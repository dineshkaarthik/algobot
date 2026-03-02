package com.algonit.algo.core.network

import com.algonit.algo.core.storage.SecureStorage
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.client.request.delete
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Central HTTP client for all API calls.
 *
 * Automatically injects auth headers, tenant ID, and request tracing.
 * Handles 401 responses with transparent token refresh and request retry.
 */
@Singleton
class ApiClient @Inject constructor(
    @PublishedApi internal val httpClient: HttpClient,
    private val secureStorage: SecureStorage,
    @PublishedApi internal val json: Json,
    @PublishedApi internal val authInterceptor: AuthInterceptor
) {
    @PublishedApi internal val baseUrl: String get() = ApiEndpoints.BASE_URL

    /**
     * Performs an authenticated GET request.
     */
    suspend inline fun <reified T> get(
        endpoint: String,
        queryParams: Map<String, String> = emptyMap()
    ): T {
        return executeWithRetry {
            httpClient.get("$baseUrl$endpoint") {
                applyHeaders()
                queryParams.forEach { (key, value) -> parameter(key, value) }
            }
        }
    }

    /**
     * Performs an authenticated POST request with an optional JSON body.
     */
    suspend inline fun <reified T> post(
        endpoint: String,
        body: Any? = null
    ): T {
        return executeWithRetry {
            httpClient.post("$baseUrl$endpoint") {
                applyHeaders()
                contentType(ContentType.Application.Json)
                body?.let { setBody(it) }
            }
        }
    }

    /**
     * Performs an authenticated PUT request with an optional JSON body.
     */
    suspend inline fun <reified T> put(
        endpoint: String,
        body: Any? = null
    ): T {
        return executeWithRetry {
            httpClient.put("$baseUrl$endpoint") {
                applyHeaders()
                contentType(ContentType.Application.Json)
                body?.let { setBody(it) }
            }
        }
    }

    /**
     * Performs an authenticated DELETE request.
     */
    suspend inline fun <reified T> delete(
        endpoint: String
    ): T {
        return executeWithRetry {
            httpClient.delete("$baseUrl$endpoint") {
                applyHeaders()
            }
        }
    }

    /**
     * Performs a POST request without auth headers (for login/register).
     */
    suspend inline fun <reified T> postUnauthenticated(
        endpoint: String,
        body: Any? = null
    ): T {
        val response: HttpResponse = httpClient.post("$baseUrl$endpoint") {
            header("X-Request-ID", UUID.randomUUID().toString())
            contentType(ContentType.Application.Json)
            body?.let { setBody(it) }
        }
        return handleResponse(response)
    }

    /**
     * Uploads an audio file using multipart form data.
     */
    suspend inline fun <reified T> uploadAudio(
        endpoint: String,
        audioFile: File,
        mimeType: String = "audio/m4a"
    ): T {
        return executeWithRetry {
            httpClient.submitFormWithBinaryData(
                url = "$baseUrl$endpoint",
                formData = formData {
                    append("audio", audioFile.readBytes(), Headers.build {
                        append(HttpHeaders.ContentType, mimeType)
                        append(HttpHeaders.ContentDisposition, "filename=\"${audioFile.name}\"")
                    })
                }
            ) {
                applyHeaders()
            }
        }
    }

    /**
     * Executes a request with automatic 401 retry after token refresh.
     */
    @PublishedApi
    internal suspend inline fun <reified T> executeWithRetry(
        crossinline request: suspend () -> HttpResponse
    ): T {
        val response = request()

        if (response.status.value == 401) {
            // Attempt token refresh
            val refreshed = authInterceptor.refreshToken(httpClient)
            if (refreshed) {
                // Retry the original request with the new token
                val retryResponse = request()
                return handleResponse(retryResponse)
            }
        }

        return handleResponse(response)
    }

    /**
     * Applies standard auth and tracing headers to a request.
     */
    @PublishedApi
    internal fun HttpRequestBuilder.applyHeaders() {
        authInterceptor.getAuthorizationHeader()?.let { auth ->
            header("Authorization", auth)
        }
        authInterceptor.getTenantId()?.let { tenantId ->
            header("X-Tenant-ID", tenantId)
        }
        header("X-Request-ID", UUID.randomUUID().toString())
    }

    /**
     * Handles the HTTP response, mapping error responses to [ApiException].
     */
    @PublishedApi
    internal suspend inline fun <reified T> handleResponse(response: HttpResponse): T {
        if (response.status.isSuccess()) {
            return response.body<T>()
        }

        val errorText = response.bodyAsText()
        val retryAfter = response.headers["Retry-After"]?.toIntOrNull()

        val apiError = try {
            json.decodeFromString<ApiErrorResponse>(errorText)
        } catch (_: Exception) {
            ApiErrorResponse(
                error = ApiErrorBody(
                    code = "HTTP_${response.status.value}",
                    message = errorText.ifBlank { response.status.description }
                )
            )
        }

        throw ApiException(
            statusCode = response.status.value,
            errorBody = apiError.error,
            retryAfter = retryAfter
        )
    }
}
