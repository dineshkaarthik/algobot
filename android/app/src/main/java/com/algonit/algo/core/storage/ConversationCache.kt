package com.algonit.algo.core.storage

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ConversationCache @Inject constructor() {

    private val mutex = Mutex()
    private val conversations = LinkedHashMap<String, CachedConversation>(
        MAX_CONVERSATIONS,
        0.75f,
        true // Access-order for LRU behavior
    )

    suspend fun getConversation(conversationId: String): CachedConversation? = mutex.withLock {
        conversations[conversationId]
    }

    suspend fun putConversation(conversation: CachedConversation) = mutex.withLock {
        conversations[conversation.id] = conversation
        evictIfNeeded()
    }

    suspend fun addMessage(conversationId: String, message: CachedMessage) = mutex.withLock {
        val conversation = conversations[conversationId] ?: return@withLock
        val messages = conversation.messages.toMutableList()
        messages.add(message)

        // Trim messages if exceeding limit
        while (messages.size > MAX_MESSAGES_PER_CONVERSATION) {
            messages.removeAt(0)
        }

        conversations[conversationId] = conversation.copy(
            messages = messages,
            lastUpdated = System.currentTimeMillis()
        )
    }

    suspend fun updateMessage(conversationId: String, messageId: String, update: (CachedMessage) -> CachedMessage) =
        mutex.withLock {
            val conversation = conversations[conversationId] ?: return@withLock
            val messages = conversation.messages.map { msg ->
                if (msg.id == messageId) update(msg) else msg
            }
            conversations[conversationId] = conversation.copy(
                messages = messages,
                lastUpdated = System.currentTimeMillis()
            )
        }

    suspend fun getMessages(conversationId: String): List<CachedMessage> = mutex.withLock {
        conversations[conversationId]?.messages ?: emptyList()
    }

    suspend fun getAllConversations(): List<CachedConversation> = mutex.withLock {
        conversations.values.sortedByDescending { it.lastUpdated }
    }

    suspend fun removeConversation(conversationId: String) = mutex.withLock {
        conversations.remove(conversationId)
    }

    suspend fun clear() = mutex.withLock {
        conversations.clear()
    }

    suspend fun size(): Int = mutex.withLock {
        conversations.size
    }

    private fun evictIfNeeded() {
        while (conversations.size > MAX_CONVERSATIONS) {
            val oldestKey = conversations.keys.firstOrNull() ?: break
            conversations.remove(oldestKey)
        }
    }

    companion object {
        const val MAX_CONVERSATIONS = 50
        const val MAX_MESSAGES_PER_CONVERSATION = 200
    }
}

data class CachedConversation(
    val id: String,
    val title: String?,
    val messages: List<CachedMessage>,
    val createdAt: Long,
    val lastUpdated: Long
)

data class CachedMessage(
    val id: String,
    val role: MessageRole,
    val content: String,
    val timestamp: Long,
    val isStreaming: Boolean = false,
    val actionConfirmation: ActionConfirmationData? = null
)

enum class MessageRole {
    USER,
    ASSISTANT,
    SYSTEM
}

data class ActionConfirmationData(
    val actionId: String,
    val description: String,
    val toolName: String,
    val parameters: Map<String, String>,
    val status: ConfirmationStatus,
    val expiresAt: Long
)

enum class ConfirmationStatus {
    PENDING,
    CONFIRMED,
    DENIED,
    EXPIRED
}
