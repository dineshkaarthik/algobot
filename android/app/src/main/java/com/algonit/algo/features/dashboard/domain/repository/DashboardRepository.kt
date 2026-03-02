package com.algonit.algo.features.dashboard.domain.repository

import com.algonit.algo.features.dashboard.data.model.AlertItem
import com.algonit.algo.features.dashboard.data.model.DashboardSummary

interface DashboardRepository {

    /**
     * Fetches the full dashboard summary including metrics and alerts
     * from the /dashboard/summary endpoint.
     */
    suspend fun getSummary(): Result<DashboardSummary>

    /**
     * Fetches only the alerts list. Falls back to extracting alerts
     * from the summary if no dedicated endpoint exists.
     */
    suspend fun getAlerts(): Result<List<AlertItem>>
}
