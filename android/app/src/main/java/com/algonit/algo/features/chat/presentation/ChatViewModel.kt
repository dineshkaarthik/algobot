package com.algonit.algo.features.chat.presentation

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.core.network.WebSocketClient
import com.algonit.algo.core.network.WsEvent
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.chat.data.model.ChatAPIResponse
import com.algonit.algo.features.chat.data.model.Message
import com.algonit.algo.features.chat.data.model.SuggestedAction
import com.algonit.algo.features.chat.domain.repository.ChatRepository
import com.algonit.algo.features.chat.domain.usecase.SendMessageUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the chat screen.
 */
data class ChatUiState(
    val messages: List<Message> = emptyList(),
    val isLoading: Boolean = false,
    val isStreaming: Boolean = false,
    val streamingText: String = "",
    val error: String? = null,
    val suggestedActions: List<SuggestedAction>? = null,
    val conversationId: String? = null,
    val hasMoreMessages: Boolean = false,
    val isLoadingMore: Boolean = false
)

/**
 * ViewModel managing the chat conversation state.
 * Handles message sending, WebSocket streaming, action confirmation,
 * and message history pagination.
 */
@HiltViewModel
class ChatViewModel @Inject constructor(
    private val sendMessageUseCase: SendMessageUseCase,
    private val chatRepository: ChatRepository,
    private val webSocketClient: WebSocketClient,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    // Public convenience accessors for Compose
    val messages: StateFlow<List<Message>> get() = MutableStateFlow(_uiState.value.messages).also { flow ->
        viewModelScope.launch {
            _uiState.collect { (flow as MutableStateFlow).value = it.messages }
        }
    }

    val suggestedActions: StateFlow<List<SuggestedAction>?> get() = MutableStateFlow(_uiState.value.suggestedActions).also { flow ->
        viewModelScope.launch {
            _uiState.collect { (flow as MutableStateFlow).value = it.suggestedActions }
        }
    }

    private var currentPage = 1

    init {
        // Restore conversation ID if navigating back
        val convId = savedStateHandle.get<String>("conversationId")
        if (convId != null) {
            _uiState.update { it.copy(conversationId = convId) }
            loadMessageHistory(convId)
        }

        // Subscribe to WebSocket events for streaming
        observeWebSocketEvents()

        // Connect WebSocket
        webSocketClient.connect()
    }

    /**
     * Sends a text message to the assistant.
     */
    fun sendMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return

        viewModelScope.launch {
            // Add optimistic user message to UI
            val userMessage = Message.createUserMessage(trimmed)
            _uiState.update { state ->
                state.copy(
                    messages = state.messages + userMessage,
                    isLoading = true,
                    error = null,
                    suggestedActions = null
                )
            }

            // Send via use case
            when (val result = sendMessageUseCase(
                conversationId = _uiState.value.conversationId,
                message = trimmed
            )) {
                is AppResult.Success -> {
                    handleChatResponse(result.data)
                }
                is AppResult.Error -> {
                    _uiState.update { state ->
                        state.copy(
                            isLoading = false,
                            error = result.error.toUserMessage()
                        )
                    }
                }
            }
        }
    }

    /**
     * Sends a voice-transcribed message.
     */
    fun sendVoiceMessage(text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return

        viewModelScope.launch {
            val userMessage = Message.createUserMessage(trimmed, inputType = "voice")
            _uiState.update { state ->
                state.copy(
                    messages = state.messages + userMessage,
                    isLoading = true,
                    error = null,
                    suggestedActions = null
                )
            }

            when (val result = sendMessageUseCase(
                conversationId = _uiState.value.conversationId,
                message = trimmed,
                inputType = "voice"
            )) {
                is AppResult.Success -> handleChatResponse(result.data)
                is AppResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = result.error.toUserMessage()) }
                }
            }
        }
    }

    /**
     * Executes a suggested action by sending it as a message.
     */
    fun executeSuggestedAction(action: SuggestedAction) {
        sendMessage(action.label)
    }

    /**
     * Confirms or cancels a pending action.
     */
    fun confirmAction(confirmationId: String, confirmed: Boolean) {
        val conversationId = _uiState.value.conversationId ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            when (val result = chatRepository.confirmAction(
                conversationId = conversationId,
                confirmationId = confirmationId,
                confirmed = confirmed
            )) {
                is AppResult.Success -> handleChatResponse(result.data)
                is AppResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = result.error.toUserMessage()) }
                }
            }
        }
    }

    /**
     * Loads the next page of message history.
     */
    fun loadMoreMessages() {
        val conversationId = _uiState.value.conversationId ?: return
        if (_uiState.value.isLoadingMore || !_uiState.value.hasMoreMessages) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            currentPage++

            when (val result = chatRepository.getMessages(conversationId, currentPage)) {
                is AppResult.Success -> {
                    val olderMessages = result.data
                    _uiState.update { state ->
                        state.copy(
                            messages = olderMessages + state.messages,
                            isLoadingMore = false,
                            hasMoreMessages = olderMessages.isNotEmpty()
                        )
                    }
                }
                is AppResult.Error -> {
                    currentPage--
                    _uiState.update { it.copy(isLoadingMore = false) }
                }
            }
        }
    }

    /**
     * Clears the current error.
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    /**
     * Processes a successful chat API response.
     */
    private fun handleChatResponse(response: ChatAPIResponse) {
        val assistantMessage = response.toMessage()

        _uiState.update { state ->
            state.copy(
                messages = state.messages + assistantMessage,
                isLoading = false,
                isStreaming = false,
                streamingText = "",
                conversationId = response.conversationId,
                suggestedActions = response.response.suggestedActions
            )
        }
    }

    /**
     * Loads message history for an existing conversation.
     */
    private fun loadMessageHistory(conversationId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            when (val result = chatRepository.getMessages(conversationId)) {
                is AppResult.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            messages = result.data,
                            isLoading = false,
                            hasMoreMessages = result.data.size >= 50,
                            suggestedActions = result.data.lastOrNull()?.suggestedActions
                        )
                    }
                }
                is AppResult.Error -> {
                    _uiState.update { it.copy(isLoading = false, error = result.error.toUserMessage()) }
                }
            }
        }
    }

    /**
     * Subscribes to WebSocket events for real-time streaming responses.
     */
    private fun observeWebSocketEvents() {
        viewModelScope.launch {
            webSocketClient.events.collect { event ->
                handleWebSocketEvent(event)
            }
        }
    }

    /**
     * Handles individual WebSocket events for streaming and alerts.
     */
    private fun handleWebSocketEvent(event: WsEvent) {
        val currentConvId = _uiState.value.conversationId

        when (event.type) {
            "typing" -> {
                if (event.conversationId == currentConvId) {
                    _uiState.update { it.copy(isStreaming = true, streamingText = "") }
                }
            }
            "stream" -> {
                if (event.conversationId == currentConvId) {
                    _uiState.update { state ->
                        state.copy(
                            isStreaming = true,
                            streamingText = state.streamingText + (event.chunk ?: "")
                        )
                    }
                }
            }
            "stream_end" -> {
                if (event.conversationId == currentConvId) {
                    _uiState.update { it.copy(isStreaming = false) }
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        webSocketClient.disconnect()
    }
}
