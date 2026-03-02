package com.algonit.algo.features.notifications.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.provider.Settings

/**
 * Creates notification channels required by the Algo app.
 * Must be called from Application.onCreate() before any notifications are sent.
 */
object NotificationChannelManager {

    const val CHANNEL_ALERTS_HIGH = "alerts_high"
    const val CHANNEL_ALERTS_MEDIUM = "alerts_medium"
    const val CHANNEL_ALERTS_LOW = "alerts_low"
    const val CHANNEL_GENERAL = "general"

    fun createChannels(context: Context) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE)
                as NotificationManager

        val soundAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()

        // High priority alerts (hot leads, budget alerts, critical issues)
        val highChannel = NotificationChannel(
            CHANNEL_ALERTS_HIGH,
            "High Priority Alerts",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Critical alerts such as hot leads and budget warnings"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 100, 250)
            setSound(Settings.System.DEFAULT_NOTIFICATION_URI, soundAttributes)
            setShowBadge(true)
        }

        // Medium priority alerts (campaign performance, follow-up reminders)
        val mediumChannel = NotificationChannel(
            CHANNEL_ALERTS_MEDIUM,
            "Medium Priority Alerts",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Campaign updates and follow-up reminders"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200)
            setSound(Settings.System.DEFAULT_NOTIFICATION_URI, soundAttributes)
            setShowBadge(true)
        }

        // Low priority alerts (informational, daily summaries)
        val lowChannel = NotificationChannel(
            CHANNEL_ALERTS_LOW,
            "Low Priority Alerts",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Informational updates and daily summaries"
            enableVibration(false)
            setShowBadge(false)
        }

        // General notifications (system messages, app updates)
        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL,
            "General",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "General app notifications"
            enableVibration(false)
            setShowBadge(false)
        }

        notificationManager.createNotificationChannels(
            listOf(highChannel, mediumChannel, lowChannel, generalChannel)
        )
    }

    /**
     * Maps a notification severity string to the appropriate channel ID.
     */
    fun channelForSeverity(severity: String): String {
        return when (severity.lowercase()) {
            "high", "critical" -> CHANNEL_ALERTS_HIGH
            "medium", "warning" -> CHANNEL_ALERTS_MEDIUM
            "low", "info" -> CHANNEL_ALERTS_LOW
            else -> CHANNEL_GENERAL
        }
    }
}
