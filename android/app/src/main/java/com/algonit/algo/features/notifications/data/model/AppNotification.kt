package com.algonit.algo.features.notifications.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AppNotification(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val severity: String,
    val read: Boolean,
    @SerialName("action_url") val actionUrl: String? = null,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class NotificationListResponse(
    val notifications: List<AppNotification>,
    @SerialName("unread_count") val unreadCount: Int
)
