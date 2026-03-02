package com.algonit.algo.features.dashboard.data.repository

import com.algonit.algo.features.dashboard.data.model.AlertItem
import com.algonit.algo.features.dashboard.data.model.DashboardSummary
import com.algonit.algo.features.dashboard.domain.repository.DashboardRepository
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DashboardRepositoryImpl @Inject constructor(
    private val httpClient: HttpClient
) : DashboardRepository {

    override suspend fun getSummary(): Result<DashboardSummary> {
        return try {
            val response = httpClient.get("/dashboard/summary")
            Result.success(response.body<DashboardSummary>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getAlerts(): Result<List<AlertItem>> {
        return try {
            val summary = httpClient.get("/dashboard/summary").body<DashboardSummary>()
            Result.success(summary.alerts)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
