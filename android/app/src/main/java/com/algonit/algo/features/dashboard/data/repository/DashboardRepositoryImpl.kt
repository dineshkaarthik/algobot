package com.algonit.algo.features.dashboard.data.repository

import com.algonit.algo.core.network.ApiClient
import com.algonit.algo.core.network.ApiEndpoints
import com.algonit.algo.features.dashboard.data.model.AlertItem
import com.algonit.algo.features.dashboard.data.model.DashboardSummary
import com.algonit.algo.features.dashboard.domain.repository.DashboardRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DashboardRepositoryImpl @Inject constructor(
    private val apiClient: ApiClient
) : DashboardRepository {

    override suspend fun getSummary(): Result<DashboardSummary> {
        return try {
            val summary: DashboardSummary = apiClient.get(
                endpoint = ApiEndpoints.DASHBOARD_SUMMARY
            )
            Result.success(summary)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getAlerts(): Result<List<AlertItem>> {
        return try {
            val summary: DashboardSummary = apiClient.get(
                endpoint = ApiEndpoints.DASHBOARD_SUMMARY
            )
            Result.success(summary.alerts)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
