package com.algonit.algo.features.chat.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.algonit.algo.features.chat.data.model.MessageEntity
import kotlinx.coroutines.flow.Flow

/**
 * Room DAO for offline caching of chat messages.
 * Messages are associated with a conversation via [MessageEntity.conversationId].
 */
@Dao
interface MessageDao {

    /**
     * Returns all messages for a given conversation, ordered chronologically.
     */
    @Query("SELECT * FROM messages WHERE conversation_id = :conversationId ORDER BY timestamp ASC")
    fun getMessages(conversationId: String): Flow<List<MessageEntity>>

    /**
     * Returns all messages for a given conversation as a suspend list (non-reactive).
     */
    @Query("SELECT * FROM messages WHERE conversation_id = :conversationId ORDER BY timestamp ASC")
    suspend fun getMessagesList(conversationId: String): List<MessageEntity>

    /**
     * Inserts or replaces a list of messages.
     * Uses REPLACE strategy to handle updates to existing messages.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(messages: List<MessageEntity>)

    /**
     * Inserts or replaces a single message.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(message: MessageEntity)

    /**
     * Deletes all messages belonging to a specific conversation.
     */
    @Query("DELETE FROM messages WHERE conversation_id = :conversationId")
    suspend fun deleteByConversation(conversationId: String)

    /**
     * Deletes all cached messages.
     */
    @Query("DELETE FROM messages")
    suspend fun deleteAll()

    /**
     * Returns the count of messages in a given conversation.
     */
    @Query("SELECT COUNT(*) FROM messages WHERE conversation_id = :conversationId")
    suspend fun getMessageCount(conversationId: String): Int
}
