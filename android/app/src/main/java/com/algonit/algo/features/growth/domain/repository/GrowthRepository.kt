package com.algonit.algo.features.growth.domain.repository

import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.growth.data.model.AcceptResponse
import com.algonit.algo.features.growth.data.model.ExecutionHistoryResponse
import com.algonit.algo.features.growth.data.model.RecommendationsResponse
import com.algonit.algo.features.growth.data.model.SafetyStatus

/**
 * Domain-layer contract for Growth Copilot operations.
 * Implementations handle API calls for recommendations, execution history,
 * and safety status.
 */
interface GrowthRepository {

    /**
     * Fetches growth recommendations from the backend.
     *
     * @param limit Maximum number of recommendations to return.
     * @return The recommendations response with total count.
     */
    suspend fun getRecommendations(limit: Int = 10): AppResult<RecommendationsResponse>

    /**
     * Accepts a recommendation, triggering its associated action.
     *
     * @param id The recommendation ID to accept.
     * @return The accept response containing the confirmation ID.
     */
    suspend fun acceptRecommendation(id: String): AppResult<AcceptResponse>

    /**
     * Dismisses a recommendation so it no longer appears in the list.
     *
     * @param id The recommendation ID to dismiss.
     */
    suspend fun dismissRecommendation(id: String): AppResult<Unit>

    /**
     * Fetches the execution history of previously accepted recommendations.
     *
     * @param limit Maximum number of entries to return.
     * @return The execution history response.
     */
    suspend fun getExecutionHistory(limit: Int = 10): AppResult<ExecutionHistoryResponse>

    /**
     * Fetches the current safety status including action limits and usage.
     *
     * @return The safety status with hourly/daily usage and limits.
     */
    suspend fun getSafetyStatus(): AppResult<SafetyStatus>
}
