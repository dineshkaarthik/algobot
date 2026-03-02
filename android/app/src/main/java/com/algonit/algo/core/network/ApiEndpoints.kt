package com.algonit.algo.core.network

import com.algonit.algo.BuildConfig

/**
 * Centralized API endpoint definitions.
 * All paths are relative to the base URL configured in BuildConfig.
 */
object ApiEndpoints {

    val BASE_URL: String get() = BuildConfig.BASE_URL
    val WS_URL: String get() = BuildConfig.WS_URL

    // Auth
    const val LOGIN = "/auth/login"
    const val REFRESH = "/auth/refresh"
    const val LOGOUT = "/auth/logout"
    const val REGISTER = "/auth/register"

    // Chat
    const val MESSAGE = "/chat/message"
    const val CONFIRM = "/chat/confirm"
    const val CONVERSATIONS = "/chat/conversations"
    fun messages(conversationId: String) = "/chat/conversations/$conversationId/messages"
    const val SUGGESTIONS = "/chat/suggestions"
    const val BUDGET = "/chat/budget"

    // Dashboard
    const val DASHBOARD_SUMMARY = "/dashboard/summary"
    const val DASHBOARD_ALERTS = "/dashboard/alerts"

    // Audio
    const val AUDIO_UPLOAD = "/audio/upload"
    const val AUDIO_TTS = "/audio/tts"

    // Devices
    const val DEVICE_REGISTER = "/devices/register"
    const val DEVICE_UNREGISTER = "/devices/unregister"

    // Notifications
    const val NOTIFICATIONS_LIST = "/notifications"
    fun notificationMarkRead(id: String) = "/notifications/$id/read"
    const val NOTIFICATIONS_MARK_ALL_READ = "/notifications/read-all"
    const val NOTIFICATION_SETTINGS = "/notifications/settings"
    const val NOTIFICATION_UPDATE_SETTINGS = "/notifications/settings"

    // Growth / Recommendations
    const val RECOMMENDATIONS = "/recommendations"
    fun recommendationAccept(id: String) = "/recommendations/$id/accept"
    fun recommendationDismiss(id: String) = "/recommendations/$id/dismiss"
    const val RECOMMENDATIONS_HISTORY = "/recommendations/history"
    const val RECOMMENDATIONS_SAFETY = "/recommendations/safety"
}
