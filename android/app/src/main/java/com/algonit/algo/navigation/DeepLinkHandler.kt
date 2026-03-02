package com.algonit.algo.navigation

import android.content.Intent

/**
 * Parses notification-triggered intents into navigation actions.
 * Deep link URIs follow the pattern: algo://algonit.com/{path}
 *
 * Supported paths:
 * - /chat/{conversationId}  -> Opens a specific conversation
 * - /dashboard              -> Opens the dashboard
 * - /notifications          -> Opens the notifications list
 * - /leads/{leadId}         -> Opens chat with lead context
 * - /campaigns/{campaignId} -> Opens chat with campaign context
 */
object DeepLinkHandler {

    private const val SCHEME = "algo"
    private const val HOST = "algonit.com"

    /**
     * Represents a resolved navigation destination from a deep link.
     */
    sealed class DeepLinkDestination {
        data object Dashboard : DeepLinkDestination()
        data object Notifications : DeepLinkDestination()
        data object Chat : DeepLinkDestination()
        data class ChatDetail(val conversationId: String) : DeepLinkDestination()
        data class LeadDetail(val leadId: String) : DeepLinkDestination()
        data class CampaignDetail(val campaignId: String) : DeepLinkDestination()
    }

    /**
     * Parses an incoming [Intent] and returns a [DeepLinkDestination] if the intent
     * contains a valid deep link, or null otherwise.
     */
    fun parse(intent: Intent?): DeepLinkDestination? {
        val uri = intent?.data ?: return parseFromExtras(intent)

        if (uri.scheme != SCHEME || uri.host != HOST) return null

        val pathSegments = uri.pathSegments
        if (pathSegments.isNullOrEmpty()) return null

        return when (pathSegments[0]) {
            "dashboard" -> DeepLinkDestination.Dashboard
            "notifications" -> DeepLinkDestination.Notifications
            "chat" -> {
                if (pathSegments.size > 1) {
                    DeepLinkDestination.ChatDetail(pathSegments[1])
                } else {
                    DeepLinkDestination.Chat
                }
            }
            "leads" -> {
                if (pathSegments.size > 1) {
                    DeepLinkDestination.LeadDetail(pathSegments[1])
                } else null
            }
            "campaigns" -> {
                if (pathSegments.size > 1) {
                    DeepLinkDestination.CampaignDetail(pathSegments[1])
                } else null
            }
            else -> null
        }
    }

    /**
     * Falls back to checking intent extras set by the notification builder,
     * e.g. when an FCM notification data payload contains navigation info.
     */
    private fun parseFromExtras(intent: Intent?): DeepLinkDestination? {
        if (intent == null) return null

        val type = intent.getStringExtra("notification_type") ?: return null
        val targetId = intent.getStringExtra("target_id")

        return when (type) {
            "hot_lead" -> targetId?.let { DeepLinkDestination.LeadDetail(it) }
            "campaign_drop" -> targetId?.let { DeepLinkDestination.CampaignDetail(it) }
            "chat_message" -> targetId?.let { DeepLinkDestination.ChatDetail(it) }
                ?: DeepLinkDestination.Chat
            "alert" -> DeepLinkDestination.Notifications
            else -> DeepLinkDestination.Notifications
        }
    }

    /**
     * Converts a [DeepLinkDestination] to a navigation route string
     * usable with Jetpack Navigation.
     */
    fun destinationToRoute(destination: DeepLinkDestination): String {
        return when (destination) {
            is DeepLinkDestination.Dashboard -> Screen.Dashboard.route
            is DeepLinkDestination.Notifications -> Screen.Notifications.route
            is DeepLinkDestination.Chat -> Screen.Chat.route
            is DeepLinkDestination.ChatDetail -> Screen.ChatDetail.createRoute(destination.conversationId)
            is DeepLinkDestination.LeadDetail -> Screen.Chat.route // Open chat with lead context
            is DeepLinkDestination.CampaignDetail -> Screen.Chat.route // Open chat with campaign context
        }
    }
}
