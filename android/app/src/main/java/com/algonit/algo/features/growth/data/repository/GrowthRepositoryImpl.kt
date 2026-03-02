package com.algonit.algo.features.growth.data.repository

import com.algonit.algo.core.network.ApiClient
import com.algonit.algo.core.network.ApiEndpoints
import com.algonit.algo.core.network.toApiError
import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.growth.data.model.AcceptResponse
import com.algonit.algo.features.growth.data.model.ExecutionHistoryResponse
import com.algonit.algo.features.growth.data.model.RecommendationsResponse
import com.algonit.algo.features.growth.data.model.SafetyStatus
import com.algonit.algo.features.growth.domain.repository.GrowthRepository
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Production implementation of [GrowthRepository].
 * Handles all Growth Copilot API calls via [ApiClient].
 */
@Singleton
class GrowthRepositoryImpl @Inject constructor(
    private val apiClient: ApiClient
) : GrowthRepository {

    override suspend fun getRecommendations(limit: Int): AppResult<RecommendationsResponse> {
        return try {
            val response: RecommendationsResponse = apiClient.get(
                endpoint = ApiEndpoints.RECOMMENDATIONS,
                queryParams = mapOf("limit" to limit.toString())
            )
            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun acceptRecommendation(id: String): AppResult<AcceptResponse> {
        return try {
            val response: AcceptResponse = apiClient.post(
                endpoint = ApiEndpoints.recommendationAccept(id)
            )
            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun dismissRecommendation(id: String): AppResult<Unit> {
        return try {
            apiClient.post<Unit>(
                endpoint = ApiEndpoints.recommendationDismiss(id)
            )
            AppResult.Success(Unit)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun getExecutionHistory(limit: Int): AppResult<ExecutionHistoryResponse> {
        return try {
            val response: ExecutionHistoryResponse = apiClient.get(
                endpoint = ApiEndpoints.RECOMMENDATIONS_HISTORY,
                queryParams = mapOf("limit" to limit.toString())
            )
            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }

    override suspend fun getSafetyStatus(): AppResult<SafetyStatus> {
        return try {
            val response: SafetyStatus = apiClient.get(
                endpoint = ApiEndpoints.RECOMMENDATIONS_SAFETY
            )
            AppResult.Success(response)
        } catch (e: Exception) {
            AppResult.Error(e.toApiError())
        }
    }
}
