package com.algonit.algo.features.chat.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Represents a conversation session between the user and the assistant.
 * Matches the response from GET /chat/conversations.
 */
@Serializable
data class Conversation(
    val id: String,
    val title: String? = null,
    @SerialName("last_message") val lastMessage: String? = null,
    @SerialName("message_count") val messageCount: Int,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
) {
    /**
     * Returns a display-friendly title, falling back to a truncated
     * version of the last message or a default string.
     */
    val displayTitle: String
        get() = title
            ?: lastMessage?.take(50)?.let { if (it.length == 50) "$it..." else it }
            ?: "New Conversation"
}

/**
 * Paginated list response for conversations.
 */
@Serializable
data class ConversationListResponse(
    val conversations: List<Conversation>,
    val pagination: Pagination
)

/**
 * Pagination metadata included in list responses.
 */
@Serializable
data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int? = null,
    @SerialName("has_more") val hasMore: Boolean? = null
)

/**
 * Room entity for offline conversation caching.
 */
@androidx.room.Entity(tableName = "conversations")
data class ConversationEntity(
    @androidx.room.PrimaryKey val id: String,
    val title: String? = null,
    @androidx.room.ColumnInfo(name = "last_message") val lastMessage: String? = null,
    @androidx.room.ColumnInfo(name = "message_count") val messageCount: Int,
    @androidx.room.ColumnInfo(name = "created_at") val createdAt: String,
    @androidx.room.ColumnInfo(name = "updated_at") val updatedAt: String
)
