package com.algonit.algo.features.chat.data.repository

import com.algonit.algo.core.network.ApiClient
import com.algonit.algo.core.network.ApiEndpoints
import com.algonit.algo.core.network.toApiError
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.chat.data.model.BudgetResponse
import com.algonit.algo.features.chat.data.model.ChatAPIResponse
import com.algonit.algo.features.chat.data.model.ChatRequest
import com.algonit.algo.features.chat.data.model.ConfirmRequest
import com.algonit.algo.features.chat.data.model.Conversation
import com.algonit.algo.features.chat.data.model.ConversationListResponse
import com.algonit.algo.features.chat.data.model.Message
import com.algonit.algo.features.chat.data.model.MessagesListResponse
import com.algonit.algo.features.chat.data.model.StatusResponse
import com.algonit.algo.features.chat.data.model.SuggestionsResponse
import com.algonit.algo.features.chat.domain.repository.ChatRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Production implementation of [ChatRepository].
 * Handles all chat-related API calls via [ApiClient] and manages
 * in-memory caching through [ConversationCache].
 */
@Singleton
class ChatRepositoryImpl @Inject constructor(
    private val apiClient: ApiClient
) : ChatRepository {

    override suspend fun sendMessage(
        conversationId: String?,
        message: String,
        inputType: String
    ): AppResult<ChatAPIResponse> {
        return try {
            val request = ChatRequest(
                conversationId = conversationId,
                message = message,
                inputType = inputType
            )

            val response: ChatAPIResponse = apiClient.post(
                endpoint = ApiEndpoints.MESSAGE,
                body = request
            )

            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun confirmAction(
        conversationId: String,
        confirmationId: String,
        confirmed: Boolean
    ): AppResult<ChatAPIResponse> {
        return try {
            val request = ConfirmRequest(
                conversationId = conversationId,
                confirmationId = confirmationId,
                confirmed = confirmed
            )

            val response: ChatAPIResponse = apiClient.post(
                endpoint = ApiEndpoints.CONFIRM,
                body = request
            )

            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun getConversations(
        page: Int,
        limit: Int
    ): AppResult<List<Conversation>> {
        return try {
            val response: ConversationListResponse = apiClient.get(
                endpoint = ApiEndpoints.CONVERSATIONS,
                queryParams = mapOf(
                    "page" to page.toString(),
                    "limit" to limit.toString()
                )
            )

            AppResult.Success(response.conversations)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun getMessages(
        conversationId: String,
        page: Int,
        limit: Int
    ): AppResult<List<Message>> {
        return try {
            val response: MessagesListResponse = apiClient.get(
                endpoint = ApiEndpoints.messages(conversationId),
                queryParams = mapOf(
                    "page" to page.toString(),
                    "limit" to limit.toString()
                )
            )

            AppResult.Success(response.messages)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun archiveConversation(id: String): AppResult<Unit> {
        return try {
            apiClient.delete<StatusResponse>(
                endpoint = "${ApiEndpoints.CONVERSATIONS}/$id"
            )

            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun getSuggestions(): AppResult<SuggestionsResponse> {
        return try {
            val response: SuggestionsResponse = apiClient.get(
                endpoint = ApiEndpoints.SUGGESTIONS
            )

            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun getBudget(): AppResult<BudgetResponse> {
        return try {
            val response: BudgetResponse = apiClient.get(
                endpoint = ApiEndpoints.BUDGET
            )

            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }
}
