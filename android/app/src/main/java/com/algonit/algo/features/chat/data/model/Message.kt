package com.algonit.algo.features.chat.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * A single message in a conversation, representing either a user input
 * or an assistant response. Matches the API response format from
 * GET /chat/conversations/:id/messages.
 */
@Serializable
data class Message(
    val id: String,
    val role: String,
    val content: String,
    @SerialName("input_type") val inputType: String? = null,
    @SerialName("structured_data") val structuredData: StructuredData? = null,
    @SerialName("suggested_actions") val suggestedActions: List<SuggestedAction>? = null,
    val intent: String? = null,
    @SerialName("requires_confirmation") val requiresConfirmation: Boolean? = null,
    @SerialName("confirmation_id") val confirmationId: String? = null,
    val timestamp: String
) {
    /**
     * True if this message was sent by the user.
     */
    val isUser: Boolean
        get() = role == ROLE_USER

    /**
     * True if this message was sent by the assistant.
     */
    val isAssistant: Boolean
        get() = role == ROLE_ASSISTANT

    /**
     * True if this message is a system-level message.
     */
    val isSystem: Boolean
        get() = role == ROLE_SYSTEM

    /**
     * True if this message contains structured data that can be rendered
     * as a rich card (metrics, charts, confirmation details).
     */
    val hasStructuredData: Boolean
        get() = structuredData != null

    /**
     * True if this message has suggested follow-up actions.
     */
    val hasSuggestedActions: Boolean
        get() = !suggestedActions.isNullOrEmpty()

    /**
     * True if this message requires user confirmation before executing an action.
     */
    val needsConfirmation: Boolean
        get() = requiresConfirmation == true && confirmationId != null

    companion object {
        const val ROLE_USER = "user"
        const val ROLE_ASSISTANT = "assistant"
        const val ROLE_SYSTEM = "system"

        /**
         * Creates a local user message before it is sent to the server.
         * Uses a temporary ID that will be replaced by the server response.
         */
        fun createUserMessage(
            content: String,
            inputType: String = "text"
        ): Message = Message(
            id = "local_${System.currentTimeMillis()}",
            role = ROLE_USER,
            content = content,
            inputType = inputType,
            timestamp = java.time.Instant.now().toString()
        )
    }
}

/**
 * Room entity for offline message caching.
 * Stored separately from the serializable API model for database compatibility.
 */
@androidx.room.Entity(tableName = "messages")
data class MessageEntity(
    @androidx.room.PrimaryKey val id: String,
    @androidx.room.ColumnInfo(name = "conversation_id") val conversationId: String,
    val role: String,
    val content: String,
    @androidx.room.ColumnInfo(name = "input_type") val inputType: String? = null,
    @androidx.room.ColumnInfo(name = "structured_data_json") val structuredDataJson: String? = null,
    @androidx.room.ColumnInfo(name = "suggested_actions_json") val suggestedActionsJson: String? = null,
    val intent: String? = null,
    @androidx.room.ColumnInfo(name = "requires_confirmation") val requiresConfirmation: Boolean = false,
    @androidx.room.ColumnInfo(name = "confirmation_id") val confirmationId: String? = null,
    val timestamp: String
)
