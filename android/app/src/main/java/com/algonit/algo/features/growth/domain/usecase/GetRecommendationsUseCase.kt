package com.algonit.algo.features.growth.domain.usecase

import com.algonit.algo.core.util.AppResult
import com.algonit.algo.features.growth.data.model.RecommendationsResponse
import com.algonit.algo.features.growth.domain.repository.GrowthRepository
import javax.inject.Inject

/**
 * Use case that fetches growth recommendations.
 *
 * Encapsulates the business logic for retrieving recommendations,
 * keeping the ViewModel thin and the repository focused on I/O.
 */
class GetRecommendationsUseCase @Inject constructor(
    private val growthRepository: GrowthRepository
) {
    /**
     * Fetches up to [limit] recommendations from the backend.
     *
     * @param limit Maximum number of recommendations to return.
     * @return [AppResult] wrapping the [RecommendationsResponse] on success.
     */
    suspend operator fun invoke(limit: Int = 10): AppResult<RecommendationsResponse> {
        return growthRepository.getRecommendations(limit)
    }
}
