package com.algonit.algo.features.chat.domain.repository

import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.chat.data.model.BudgetResponse
import com.algonit.algo.features.chat.data.model.ChatAPIResponse
import com.algonit.algo.features.chat.data.model.Conversation
import com.algonit.algo.features.chat.data.model.Message
import com.algonit.algo.features.chat.data.model.SuggestionsResponse

/**
 * Domain-layer contract for chat operations.
 * Implementations handle HTTP calls, caching, and offline support.
 */
interface ChatRepository {

    /**
     * Sends a text or voice message to the assistant.
     *
     * @param conversationId The conversation to continue, or null to start a new one.
     * @param message The user's message content.
     * @param inputType The input method: "text" or "voice".
     * @return The full API response including the assistant's reply and metadata.
     */
    suspend fun sendMessage(
        conversationId: String?,
        message: String,
        inputType: String = "text"
    ): AppResult<ChatAPIResponse>

    /**
     * Confirms or cancels a pending action that requires user approval.
     *
     * @param conversationId The conversation containing the pending action.
     * @param confirmationId The unique identifier of the confirmation request.
     * @param confirmed True to execute the action, false to cancel it.
     */
    suspend fun confirmAction(
        conversationId: String,
        confirmationId: String,
        confirmed: Boolean
    ): AppResult<ChatAPIResponse>

    /**
     * Retrieves the paginated list of conversations for the current user.
     *
     * @param page The page number (1-indexed).
     * @param limit The maximum number of conversations per page.
     */
    suspend fun getConversations(
        page: Int = 1,
        limit: Int = 20
    ): AppResult<List<Conversation>>

    /**
     * Retrieves the paginated message history for a conversation.
     *
     * @param conversationId The conversation to load messages from.
     * @param page The page number (1-indexed).
     * @param limit The maximum number of messages per page.
     */
    suspend fun getMessages(
        conversationId: String,
        page: Int = 1,
        limit: Int = 50
    ): AppResult<List<Message>>

    /**
     * Archives (soft-deletes) a conversation.
     */
    suspend fun archiveConversation(id: String): AppResult<Unit>

    /**
     * Retrieves contextual suggestions for starting a new conversation.
     */
    suspend fun getSuggestions(): AppResult<SuggestionsResponse>

    /**
     * Retrieves the current token budget/usage for the user.
     */
    suspend fun getBudget(): AppResult<BudgetResponse>
}
