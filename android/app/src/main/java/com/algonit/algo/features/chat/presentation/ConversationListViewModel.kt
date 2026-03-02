package com.algonit.algo.features.chat.presentation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.chat.data.model.Conversation
import com.algonit.algo.features.chat.domain.repository.ChatRepository
import com.algonit.algo.features.chat.domain.usecase.GetConversationsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * UI state for the conversation list screen.
 */
data class ConversationListUiState(
    val conversations: List<Conversation> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val hasMorePages: Boolean = true,
    val isLoadingMore: Boolean = false
)

/**
 * ViewModel managing the conversation history list.
 * Supports cache-first loading, pull-to-refresh, pagination,
 * and conversation archival.
 */
@HiltViewModel
class ConversationListViewModel @Inject constructor(
    private val getConversationsUseCase: GetConversationsUseCase,
    private val chatRepository: ChatRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ConversationListUiState())
    val uiState: StateFlow<ConversationListUiState> = _uiState.asStateFlow()

    private var currentPage = 1
    private val pageSize = 20

    init {
        loadConversations()
    }

    /**
     * Loads conversations using the cache-first use case.
     * Emits cached data immediately, then updates with network data.
     */
    fun loadConversations() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            currentPage = 1

            getConversationsUseCase(page = 1, limit = pageSize).collect { result ->
                when (result) {
                    is AppResult.Success -> {
                        _uiState.update {
                            it.copy(
                                conversations = result.data,
                                isLoading = false,
                                isRefreshing = false,
                                hasMorePages = result.data.size >= pageSize
                            )
                        }
                    }
                    is AppResult.Error -> {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                isRefreshing = false,
                                error = result.error.toUserMessage()
                            )
                        }
                    }
                }
            }
        }
    }

    /**
     * Loads the next page of conversations for infinite scroll.
     */
    fun loadNextPage() {
        if (_uiState.value.isLoadingMore || !_uiState.value.hasMorePages) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingMore = true) }
            currentPage++

            when (val result = chatRepository.getConversations(currentPage, pageSize)) {
                is AppResult.Success -> {
                    _uiState.update { state ->
                        state.copy(
                            conversations = state.conversations + result.data,
                            isLoadingMore = false,
                            hasMorePages = result.data.size >= pageSize
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
     * Refreshes the conversation list from the network (pull-to-refresh).
     */
    fun refresh() {
        viewModelScope.launch {
            _uiState.update { it.copy(isRefreshing = true) }
            currentPage = 1

            when (val result = chatRepository.getConversations(1, pageSize)) {
                is AppResult.Success -> {
                    _uiState.update {
                        it.copy(
                            conversations = result.data,
                            isRefreshing = false,
                            hasMorePages = result.data.size >= pageSize,
                            error = null
                        )
                    }
                }
                is AppResult.Error -> {
                    _uiState.update {
                        it.copy(
                            isRefreshing = false,
                            error = result.error.toUserMessage()
                        )
                    }
                }
            }
        }
    }

    /**
     * Archives a conversation, removing it from the list.
     */
    fun archiveConversation(id: String) {
        viewModelScope.launch {
            // Optimistically remove from list
            val previousConversations = _uiState.value.conversations
            _uiState.update { state ->
                state.copy(
                    conversations = state.conversations.filter { it.id != id }
                )
            }

            when (chatRepository.archiveConversation(id)) {
                is AppResult.Success -> {
                    // Already removed optimistically
                }
                is AppResult.Error -> {
                    // Restore on failure
                    _uiState.update { state ->
                        state.copy(
                            conversations = previousConversations,
                            error = "Failed to archive conversation"
                        )
                    }
                }
            }
        }
    }

    /**
     * Clears the current error message.
     */
    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
