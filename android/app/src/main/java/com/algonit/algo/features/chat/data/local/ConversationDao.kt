package com.algonit.algo.features.chat.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.algonit.algo.features.chat.data.model.ConversationEntity
import kotlinx.coroutines.flow.Flow

/**
 * Room DAO for offline caching of conversation metadata.
 * Provides reactive and suspend access patterns for the conversation list.
 */
@Dao
interface ConversationDao {

    /**
     * Returns all cached conversations, ordered by most recently updated first.
     * Emits a new list whenever the underlying data changes.
     */
    @Query("SELECT * FROM conversations ORDER BY updated_at DESC")
    fun getAll(): Flow<List<ConversationEntity>>

    /**
     * Returns all cached conversations as a suspend list (non-reactive).
     */
    @Query("SELECT * FROM conversations ORDER BY updated_at DESC")
    suspend fun getAllList(): List<ConversationEntity>

    /**
     * Returns a single conversation by its ID, or null if not cached.
     */
    @Query("SELECT * FROM conversations WHERE id = :conversationId LIMIT 1")
    suspend fun getById(conversationId: String): ConversationEntity?

    /**
     * Inserts or replaces a list of conversations.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(conversations: List<ConversationEntity>)

    /**
     * Inserts or replaces a single conversation.
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(conversation: ConversationEntity)

    /**
     * Deletes a conversation entity.
     */
    @Delete
    suspend fun delete(conversation: ConversationEntity)

    /**
     * Deletes a conversation by its ID.
     */
    @Query("DELETE FROM conversations WHERE id = :conversationId")
    suspend fun deleteById(conversationId: String)

    /**
     * Deletes all cached conversations.
     */
    @Query("DELETE FROM conversations")
    suspend fun deleteAll()
}
