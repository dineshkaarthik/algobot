package com.algonit.algo.features.chat.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Full API response from POST /chat/message and POST /chat/confirm.
 */
@Serializable
data class ChatAPIResponse(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("message_id") val messageId: String,
    val response: ChatResponseBody,
    val intent: IntentInfo? = null,
    val timestamp: String
) {
    /**
     * Converts the API response into a [Message] for use in the UI layer.
     */
    fun toMessage(): Message = Message(
        id = messageId,
        role = Message.ROLE_ASSISTANT,
        content = response.text,
        structuredData = response.structuredData,
        suggestedActions = response.suggestedActions,
        intent = intent?.classifiedAs,
        requiresConfirmation = response.requiresConfirmation,
        confirmationId = response.confirmationId,
        timestamp = timestamp
    )
}

/**
 * The response body within a [ChatAPIResponse], containing the assistant's
 * text reply and any structured data or suggested actions.
 */
@Serializable
data class ChatResponseBody(
    val text: String,
    @SerialName("structured_data") val structuredData: StructuredData? = null,
    @SerialName("suggested_actions") val suggestedActions: List<SuggestedAction>? = null,
    @SerialName("requires_confirmation") val requiresConfirmation: Boolean? = null,
    @SerialName("confirmation_id") val confirmationId: String? = null
)

/**
 * Intent classification metadata from the agent's reasoning.
 */
@Serializable
data class IntentInfo(
    @SerialName("classified_as") val classifiedAs: String,
    val confidence: Double
)

/**
 * Token budget information for rate limiting awareness.
 */
@Serializable
data class TokenBudgetInfo(
    @SerialName("tokens_used") val tokensUsed: Int,
    @SerialName("tokens_remaining") val tokensRemaining: Int,
    @SerialName("tokens_total") val tokensTotal: Int,
    @SerialName("reset_at") val resetAt: String? = null
)

// --- Request models ---

/**
 * Request body for POST /chat/message.
 */
@Serializable
data class ChatRequest(
    @SerialName("conversation_id") val conversationId: String? = null,
    val message: String,
    @SerialName("input_type") val inputType: String = "text",
    @SerialName("audio_url") val audioUrl: String? = null,
    val context: ChatContext? = null
)

/**
 * Optional context sent with a chat message to provide the assistant
 * with information about the user's current state.
 */
@Serializable
data class ChatContext(
    val screen: String? = null,
    @SerialName("selected_campaign_id") val selectedCampaignId: String? = null
)

/**
 * Request body for POST /chat/confirm.
 */
@Serializable
data class ConfirmRequest(
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("confirmation_id") val confirmationId: String,
    val confirmed: Boolean
)

// --- Additional response models ---

/**
 * Response from GET /chat/suggestions, providing contextual suggestions
 * for the user to start a conversation.
 */
@Serializable
data class SuggestionsResponse(
    val suggestions: List<SuggestedAction>
)

/**
 * Response from GET /chat/budget, providing token usage information.
 */
@Serializable
data class BudgetResponse(
    val budget: TokenBudgetInfo
)

/**
 * Response from GET /chat/conversations/:id/messages.
 */
@Serializable
data class MessagesListResponse(
    val messages: List<Message>,
    val pagination: Pagination
)

/**
 * Generic status response for operations like archive.
 */
@Serializable
data class StatusResponse(
    val status: String,
    val message: String? = null
)
