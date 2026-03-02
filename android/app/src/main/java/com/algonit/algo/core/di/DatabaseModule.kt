package com.algonit.algo.core.di

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context
    ): AlgoDatabase {
        return Room.databaseBuilder(
            context,
            AlgoDatabase::class.java,
            AlgoDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideMessageDao(database: AlgoDatabase): MessageDao {
        return database.messageDao()
    }

    @Provides
    fun provideConversationDao(database: AlgoDatabase): ConversationDao {
        return database.conversationDao()
    }
}

@Database(
    entities = [MessageEntity::class, ConversationEntity::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AlgoDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao
    abstract fun conversationDao(): ConversationDao

    companion object {
        const val DATABASE_NAME = "algo_database"
    }
}

// Type converters for Room
class Converters {
    @androidx.room.TypeConverter
    fun fromStringList(value: List<String>?): String? {
        return value?.joinToString(",")
    }

    @androidx.room.TypeConverter
    fun toStringList(value: String?): List<String>? {
        return value?.split(",")?.filter { it.isNotBlank() }
    }
}

// Entities
@androidx.room.Entity(tableName = "messages")
data class MessageEntity(
    @androidx.room.PrimaryKey
    val id: String,
    @androidx.room.ColumnInfo(name = "conversation_id")
    val conversationId: String,
    val role: String,
    val content: String,
    val timestamp: Long,
    @androidx.room.ColumnInfo(name = "action_id")
    val actionId: String? = null,
    @androidx.room.ColumnInfo(name = "action_status")
    val actionStatus: String? = null,
    @androidx.room.ColumnInfo(name = "is_synced")
    val isSynced: Boolean = true
)

@androidx.room.Entity(tableName = "conversations")
data class ConversationEntity(
    @androidx.room.PrimaryKey
    val id: String,
    val title: String?,
    @androidx.room.ColumnInfo(name = "created_at")
    val createdAt: Long,
    @androidx.room.ColumnInfo(name = "updated_at")
    val updatedAt: Long,
    @androidx.room.ColumnInfo(name = "message_count")
    val messageCount: Int = 0,
    @androidx.room.ColumnInfo(name = "is_archived")
    val isArchived: Boolean = false
)

// DAOs
@androidx.room.Dao
interface MessageDao {
    @androidx.room.Query("SELECT * FROM messages WHERE conversation_id = :conversationId ORDER BY timestamp ASC")
    suspend fun getMessagesForConversation(conversationId: String): List<MessageEntity>

    @androidx.room.Query("SELECT * FROM messages WHERE id = :messageId")
    suspend fun getMessageById(messageId: String): MessageEntity?

    @androidx.room.Insert(onConflict = androidx.room.OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @androidx.room.Insert(onConflict = androidx.room.OnConflictStrategy.REPLACE)
    suspend fun insertMessages(messages: List<MessageEntity>)

    @androidx.room.Update
    suspend fun updateMessage(message: MessageEntity)

    @androidx.room.Query("DELETE FROM messages WHERE conversation_id = :conversationId")
    suspend fun deleteMessagesForConversation(conversationId: String)

    @androidx.room.Query("DELETE FROM messages WHERE id = :messageId")
    suspend fun deleteMessage(messageId: String)

    @androidx.room.Query("SELECT COUNT(*) FROM messages WHERE conversation_id = :conversationId")
    suspend fun getMessageCount(conversationId: String): Int

    @androidx.room.Query("SELECT * FROM messages WHERE is_synced = 0")
    suspend fun getUnsyncedMessages(): List<MessageEntity>

    @androidx.room.Query("UPDATE messages SET is_synced = 1 WHERE id = :messageId")
    suspend fun markAsSynced(messageId: String)

    @androidx.room.Query("DELETE FROM messages")
    suspend fun deleteAll()
}

@androidx.room.Dao
interface ConversationDao {
    @androidx.room.Query("SELECT * FROM conversations WHERE is_archived = 0 ORDER BY updated_at DESC")
    suspend fun getActiveConversations(): List<ConversationEntity>

    @androidx.room.Query("SELECT * FROM conversations ORDER BY updated_at DESC")
    suspend fun getAllConversations(): List<ConversationEntity>

    @androidx.room.Query("SELECT * FROM conversations WHERE id = :conversationId")
    suspend fun getConversationById(conversationId: String): ConversationEntity?

    @androidx.room.Insert(onConflict = androidx.room.OnConflictStrategy.REPLACE)
    suspend fun insertConversation(conversation: ConversationEntity)

    @androidx.room.Insert(onConflict = androidx.room.OnConflictStrategy.REPLACE)
    suspend fun insertConversations(conversations: List<ConversationEntity>)

    @androidx.room.Update
    suspend fun updateConversation(conversation: ConversationEntity)

    @androidx.room.Query("UPDATE conversations SET is_archived = 1 WHERE id = :conversationId")
    suspend fun archiveConversation(conversationId: String)

    @androidx.room.Query("DELETE FROM conversations WHERE id = :conversationId")
    suspend fun deleteConversation(conversationId: String)

    @androidx.room.Query("UPDATE conversations SET message_count = :count, updated_at = :updatedAt WHERE id = :conversationId")
    suspend fun updateMessageCount(conversationId: String, count: Int, updatedAt: Long)

    @androidx.room.Query("DELETE FROM conversations")
    suspend fun deleteAll()
}
