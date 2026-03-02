package com.algonit.algo.core.di

import com.algonit.algo.BuildConfig
import com.algonit.algo.core.network.ApiClient
import com.algonit.algo.core.network.AuthInterceptor
import com.algonit.algo.core.network.WebSocketClient
import com.algonit.algo.core.storage.SecureStorage
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json {
        return Json {
            ignoreUnknownKeys = true
            isLenient = true
            encodeDefaults = true
            prettyPrint = false
            coerceInputValues = true
            namingStrategy = kotlinx.serialization.json.JsonNamingStrategy.SnakeCase
        }
    }

    @Provides
    @Singleton
    fun provideAuthInterceptor(
        secureStorage: SecureStorage
    ): AuthInterceptor {
        return AuthInterceptor(secureStorage)
    }

    @Provides
    @Singleton
    @Named("api")
    fun provideHttpClient(
        json: Json,
        authInterceptor: AuthInterceptor
    ): HttpClient {
        return HttpClient(Android) {
            install(ContentNegotiation) {
                json(json)
            }

            install(Logging) {
                logger = object : Logger {
                    override fun log(message: String) {
                        android.util.Log.d("AlgoHttp", message)
                    }
                }
                level = if (BuildConfig.DEBUG) LogLevel.BODY else LogLevel.NONE
            }

            install(HttpTimeout) {
                requestTimeoutMillis = 30_000
                connectTimeoutMillis = 10_000
                socketTimeoutMillis = 30_000
            }

            defaultRequest {
                contentType(ContentType.Application.Json)
            }

            // Auth interceptor is applied at the ApiClient level
            // to allow unauthenticated requests for login/register
        }
    }

    @Provides
    @Singleton
    @Named("websocket")
    fun provideWebSocketHttpClient(
        json: Json
    ): HttpClient {
        return HttpClient(Android) {
            install(WebSockets) {
                pingInterval = 25_000
            }

            install(ContentNegotiation) {
                json(json)
            }

            install(HttpTimeout) {
                requestTimeoutMillis = 60_000
                connectTimeoutMillis = 10_000
                socketTimeoutMillis = 60_000
            }
        }
    }

    @Provides
    @Singleton
    fun provideApiClient(
        @Named("api") httpClient: HttpClient,
        secureStorage: SecureStorage,
        json: Json,
        authInterceptor: AuthInterceptor
    ): ApiClient {
        return ApiClient(httpClient, secureStorage, json, authInterceptor)
    }

    @Provides
    @Singleton
    fun provideWebSocketClient(
        @Named("websocket") httpClient: HttpClient,
        secureStorage: SecureStorage,
        json: Json
    ): WebSocketClient {
        return WebSocketClient(httpClient, secureStorage, json)
    }
}
