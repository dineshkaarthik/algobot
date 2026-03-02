package com.algonit.algo.features.chat.domain.usecase

import com.algonit.algo.core.storage.CachedConversation
import com.algonit.algo.core.storage.ConversationCache
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.chat.data.model.Conversation
import com.algonit.algo.features.chat.domain.repository.ChatRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject

/**
 * Use case that retrieves conversations with a cache-first strategy.
 *
 * Flow behavior:
 * 1. Emits cached conversations immediately (if available) for instant UI.
 * 2. Fetches fresh data from the network.
 * 3. Emits the network data (replacing the cached emission).
 * 4. Updates the cache with the fresh data.
 *
 * This provides a responsive UI while keeping data fresh.
 */
class GetConversationsUseCase @Inject constructor(
    private val chatRepository: ChatRepository,
    private val conversationCache: ConversationCache
) {
    /**
     * Returns a [Flow] that emits conversation lists.
     * First emission is from cache, second is from network.
     *
     * @param page The page number for pagination.
     * @param limit The page size for pagination.
     */
    operator fun invoke(
        page: Int = 1,
        limit: Int = 20
    ): Flow<AppResult<List<Conversation>>> = flow {
        // Step 1: Emit cached conversations immediately
        val cached = conversationCache.getAllConversations()
        if (cached.isNotEmpty()) {
            emit(AppResult.Success(cached.map { it.toConversation() }))
        }

        // Step 2: Fetch from network
        val networkResult = chatRepository.getConversations(page, limit)

        // Step 3: Emit network result
        emit(networkResult)

        // Step 4: Update cache on success
        if (networkResult is AppResult.Success) {
            val conversations = networkResult.data
            if (page == 1) {
                // First page replaces the cache
                val cachedConversations = conversations.map { conv ->
                    CachedConversation(
                        id = conv.id,
                        title = conv.title ?: conv.lastMessage?.take(50),
                        messages = emptyList(),
                        createdAt = parseTimestamp(conv.createdAt),
                        lastUpdated = parseTimestamp(conv.updatedAt)
                    )
                }
                conversationCache.clear()
                cachedConversations.forEach { conversationCache.putConversation(it) }
            }
        }
    }

    /**
     * Converts a [CachedConversation] to a domain [Conversation].
     */
    private fun CachedConversation.toConversation(): Conversation = Conversation(
        id = id,
        title = title,
        messageCount = messages.size,
        createdAt = java.time.Instant.ofEpochMilli(createdAt).toString(),
        updatedAt = java.time.Instant.ofEpochMilli(lastUpdated).toString()
    )

    /**
     * Parses an ISO timestamp string to epoch milliseconds.
     */
    private fun parseTimestamp(timestamp: String): Long {
        return try {
            java.time.Instant.parse(timestamp).toEpochMilli()
        } catch (_: Exception) {
            System.currentTimeMillis()
        }
    }
}
