package com.algonit.algo.features.growth.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Recommendation(
    val id: String,
    val type: String,
    val title: String,
    val description: String,
    val confidence: Double,
    val impact: String,
    val category: String,
    val actionable: Boolean,
    val action: RecommendationAction? = null,
    val status: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class RecommendationAction(
    val tool: String,
    val params: Map<String, String>? = null
)

@Serializable
data class RecommendationsResponse(
    val recommendations: List<Recommendation>,
    val total: Int
)

@Serializable
data class AcceptResponse(
    @SerialName("confirmation_id") val confirmationId: String,
    val status: String
)
