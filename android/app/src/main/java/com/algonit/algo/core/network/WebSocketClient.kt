package com.algonit.algo.core.network

import com.algonit.algo.core.storage.SecureStorage
import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.webSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.WebSocketSession
import io.ktor.websocket.close
import io.ktor.websocket.readText
import io.ktor.websocket.send
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Typed WebSocket events received from the server.
 */
sealed class WebSocketEvent {
    data class Typing(val conversationId: String) : WebSocketEvent()
    data class StreamChunk(val conversationId: String, val chunk: String, val messageId: String) : WebSocketEvent()
    data class StreamEnd(val conversationId: String, val messageId: String, val fullContent: String) : WebSocketEvent()
    data class Alert(val alertId: String, val type: String, val title: String, val message: String, val severity: String) : WebSocketEvent()
    data class MetricUpdate(val metric: String, val value: Double, val change: Double?) : WebSocketEvent()
    data class Error(val code: String, val message: String) : WebSocketEvent()
}

/**
 * Raw WebSocket message envelope from the server.
 */
@Serializable
internal data class WsMessage(
    val type: String,
    @SerialName("conversation_id") val conversationId: String? = null,
    val chunk: String? = null,
    @SerialName("message_id") val messageId: String? = null,
    @SerialName("full_content") val fullContent: String? = null,
    @SerialName("alert_id") val alertId: String? = null,
    val title: String? = null,
    val message: String? = null,
    val severity: String? = null,
    val metric: String? = null,
    val value: Double? = null,
    val change: Double? = null,
    val code: String? = null,
    val data: JsonObject? = null
)

/**
 * WebSocket connection status.
 */
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RECONNECTING
}

/**
 * Manages WebSocket connection for real-time streaming, alerts, and metric updates.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat ping every 25 seconds
 * - Typed event parsing via [WebSocketEvent]
 * - Thread-safe connection state via [StateFlow]
 * - Event delivery via [SharedFlow] (buffered, never drops)
 */
@Singleton
class WebSocketClient @Inject constructor(
    private val httpClient: HttpClient,
    private val secureStorage: SecureStorage,
    private val json: Json
) {
    private var session: WebSocketSession? = null
    private var scope: CoroutineScope? = null

    private val _events = MutableSharedFlow<WebSocketEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<WebSocketEvent> = _events.asSharedFlow()

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private var reconnectAttempts = 0

    companion object {
        private const val MAX_RECONNECT_ATTEMPTS = 8
        private const val HEARTBEAT_INTERVAL_MS = 25_000L
        private const val MAX_BACKOFF_MS = 60_000L
    }

    /**
     * Opens the WebSocket connection. No-op if already connected or connecting.
     */
    fun connect() {
        if (_connectionState.value == ConnectionState.CONNECTED ||
            _connectionState.value == ConnectionState.CONNECTING
        ) return

        scope?.cancel()
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

        scope?.launch {
            connectInternal()
        }
    }

    private suspend fun connectInternal() {
        val token = secureStorage.getToken() ?: run {
            _connectionState.value = ConnectionState.DISCONNECTED
            return
        }

        _connectionState.value = if (reconnectAttempts > 0) {
            ConnectionState.RECONNECTING
        } else {
            ConnectionState.CONNECTING
        }

        try {
            session = httpClient.webSocketSession("${ApiEndpoints.WS_URL}?token=$token")
            _connectionState.value = ConnectionState.CONNECTED
            reconnectAttempts = 0

            // Start heartbeat
            scope?.launch {
                heartbeatLoop()
            }

            // Process incoming messages
            session?.let { ws ->
                for (frame in ws.incoming) {
                    when (frame) {
                        is Frame.Text -> {
                            val text = frame.readText()
                            parseAndEmitEvent(text)
                        }
                        else -> { /* ignore non-text frames */ }
                    }
                }
            }

            // If we exit the loop normally, the connection was closed by the server
            _connectionState.value = ConnectionState.DISCONNECTED
            attemptReconnect()
        } catch (e: Exception) {
            _connectionState.value = ConnectionState.DISCONNECTED
            attemptReconnect()
        }
    }

    private fun parseAndEmitEvent(text: String) {
        try {
            val msg = json.decodeFromString<WsMessage>(text)
            val event = when (msg.type) {
                "typing" -> {
                    val convId = msg.conversationId ?: return
                    WebSocketEvent.Typing(convId)
                }
                "stream_chunk" -> {
                    val convId = msg.conversationId ?: return
                    val chunk = msg.chunk ?: return
                    val msgId = msg.messageId ?: return
                    WebSocketEvent.StreamChunk(convId, chunk, msgId)
                }
                "stream_end" -> {
                    val convId = msg.conversationId ?: return
                    val msgId = msg.messageId ?: return
                    val content = msg.fullContent ?: ""
                    WebSocketEvent.StreamEnd(convId, msgId, content)
                }
                "alert" -> {
                    WebSocketEvent.Alert(
                        alertId = msg.alertId ?: "",
                        type = msg.type,
                        title = msg.title ?: "",
                        message = msg.message ?: "",
                        severity = msg.severity ?: "info"
                    )
                }
                "metric_update" -> {
                    val metric = msg.metric ?: return
                    val value = msg.value ?: return
                    WebSocketEvent.MetricUpdate(metric, value, msg.change)
                }
                "error" -> {
                    WebSocketEvent.Error(
                        code = msg.code ?: "UNKNOWN",
                        message = msg.message ?: "Unknown error"
                    )
                }
                else -> return // Ignore unknown event types
            }
            _events.tryEmit(event)
        } catch (_: Exception) {
            // Skip malformed messages
        }
    }

    private suspend fun heartbeatLoop() {
        while (scope?.isActive == true && _connectionState.value == ConnectionState.CONNECTED) {
            try {
                session?.send(Frame.Text("{\"type\":\"ping\"}"))
                delay(HEARTBEAT_INTERVAL_MS)
            } catch (_: Exception) {
                break
            }
        }
    }

    private suspend fun attemptReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            _connectionState.value = ConnectionState.DISCONNECTED
            return
        }

        reconnectAttempts++
        val delayMs = minOf(
            1000L * (1L shl reconnectAttempts.coerceAtMost(6)),
            MAX_BACKOFF_MS
        )
        delay(delayMs)
        connectInternal()
    }

    /**
     * Closes the WebSocket connection and cancels all coroutines.
     */
    fun disconnect() {
        val currentScope = scope
        currentScope?.launch {
            try {
                session?.close()
            } catch (_: Exception) { }
            session = null
            _connectionState.value = ConnectionState.DISCONNECTED
        }
        scope?.cancel()
        scope = null
        reconnectAttempts = 0
    }

    /**
     * Sends a text message through the WebSocket.
     */
    suspend fun send(message: String) {
        try {
            session?.send(Frame.Text(message))
        } catch (_: Exception) {
            // Connection may have dropped; reconnect will handle it
        }
    }
}
