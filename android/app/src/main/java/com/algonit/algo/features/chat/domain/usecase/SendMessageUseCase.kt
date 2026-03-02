package com.algonit.algo.features.chat.domain.usecase

import com.algonit.algo.core.network.ApiError
import com.algonit.algo.core.storage.ConversationCache
import com.algonit.algo.core.storage.CachedMessage
import com.algonit.algo.core.storage.MessageRole
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.chat.data.model.ChatAPIResponse
import com.algonit.algo.features.chat.domain.repository.ChatRepository
import javax.inject.Inject

/**
 * Use case that orchestrates sending a message to the assistant.
 *
 * Responsibilities:
 * 1. Checks the user's remaining token budget before sending.
 * 2. Sends the message via the repository.
 * 3. Caches the assistant's response locally for offline access.
 *
 * This encapsulates business logic that spans multiple concerns,
 * keeping the ViewModel thin and the repository focused on I/O.
 */
class SendMessageUseCase @Inject constructor(
    private val chatRepository: ChatRepository,
    private val conversationCache: ConversationCache
) {
    /**
     * Sends a message and returns the full API response.
     *
     * @param conversationId The conversation to continue, or null to start a new one.
     * @param message The user's message text.
     * @param inputType The input method: "text" or "voice".
     * @return [AppResult] wrapping the [ChatAPIResponse] on success.
     */
    suspend operator fun invoke(
        conversationId: String?,
        message: String,
        inputType: String = "text"
    ): AppResult<ChatAPIResponse> {
        // Step 1: Check budget (non-blocking -- proceed even if budget check fails)
        val budgetResult = chatRepository.getBudget()
        if (budgetResult is AppResult.Success) {
            val budget = budgetResult.data.budget
            if (budget.tokensRemaining <= 0) {
                val resetIn = budget.resetAt?.let { 3600L } ?: 3600L
                return AppResult.Error(
                    error = ApiError.TokenBudgetExhausted(resetIn),
                    message = "You have used all your AI credits. " +
                            "Credits reset at ${budget.resetAt ?: "the next billing cycle"}."
                )
            }
        }

        // Step 2: Send the message
        val result = chatRepository.sendMessage(conversationId, message, inputType)

        // Step 3: Cache the response locally on success
        if (result is AppResult.Success) {
            val response = result.data
            val convId = response.conversationId

            // Cache the user's message
            conversationCache.addMessage(
                conversationId = convId,
                message = CachedMessage(
                    id = "user_${System.currentTimeMillis()}",
                    role = MessageRole.USER,
                    content = message,
                    timestamp = System.currentTimeMillis()
                )
            )

            // Cache the assistant's response
            conversationCache.addMessage(
                conversationId = convId,
                message = CachedMessage(
                    id = response.messageId,
                    role = MessageRole.ASSISTANT,
                    content = response.response.text,
                    timestamp = System.currentTimeMillis()
                )
            )
        }

        return result
    }
}
