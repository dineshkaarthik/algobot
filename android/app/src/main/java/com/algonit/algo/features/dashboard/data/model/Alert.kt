package com.algonit.algo.features.dashboard.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AlertItem(
    val id: String,
    val type: String,
    val severity: String,
    val title: String,
    val message: String,
    @SerialName("created_at") val createdAt: String,
    val action: AlertAction? = null
)

@Serializable
data class AlertAction(
    val type: String,
    val params: Map<String, String>? = null
)
