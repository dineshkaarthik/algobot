package com.algonit.algo

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class AlgoApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val alertsChannel = NotificationChannel(
            CHANNEL_ALERTS,
            "Alerts & Insights",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Proactive alerts about your marketing metrics"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 100, 250)
            setSound(
                Uri.parse("android.resource://$packageName/raw/alert_sound"),
                AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build()
            )
        }

        val messagesChannel = NotificationChannel(
            CHANNEL_MESSAGES,
            "Messages",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Chat message notifications from Algo"
            enableVibration(true)
        }

        val actionsChannel = NotificationChannel(
            CHANNEL_ACTIONS,
            "Action Confirmations",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Confirmation requests for actions Algo wants to perform"
            enableVibration(true)
        }

        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL,
            "General",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "General app notifications"
        }

        notificationManager.createNotificationChannels(
            listOf(alertsChannel, messagesChannel, actionsChannel, generalChannel)
        )
    }

    companion object {
        const val CHANNEL_ALERTS = "algo_alerts"
        const val CHANNEL_MESSAGES = "algo_messages"
        const val CHANNEL_ACTIONS = "algo_actions"
        const val CHANNEL_GENERAL = "algo_general"
    }
}
