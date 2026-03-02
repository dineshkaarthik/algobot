package com.algonit.algo.features.notifications.service

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.algonit.algo.MainActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import io.ktor.client.HttpClient
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import javax.inject.Inject

@AndroidEntryPoint
class AlgoFirebaseService : FirebaseMessagingService() {

    @Inject
    lateinit var httpClient: HttpClient

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * Called when a new FCM token is generated or refreshed.
     * Registers the device token with the backend.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        registerDeviceToken(token)
    }

    /**
     * Called when a message is received from FCM.
     * Handles both notification messages (when app is in foreground)
     * and data-only messages.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: "Algo"
        val body = data["body"] ?: message.notification?.body ?: ""
        val severity = data["severity"] ?: "medium"
        val notificationType = data["type"] ?: "general"
        val targetId = data["target_id"]
        val actionUrl = data["action_url"]
        val notificationId = data["notification_id"]?.hashCode() ?: System.currentTimeMillis().toInt()

        showNotification(
            notificationId = notificationId,
            title = title,
            body = body,
            severity = severity,
            type = notificationType,
            targetId = targetId,
            actionUrl = actionUrl
        )
    }

    private fun showNotification(
        notificationId: Int,
        title: String,
        body: String,
        severity: String,
        type: String,
        targetId: String?,
        actionUrl: String?
    ) {
        val channelId = NotificationChannelManager.channelForSeverity(severity)

        // Build deep link intent
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP

            // Set deep link URI if available
            actionUrl?.let { url ->
                this.data = Uri.parse("algo://algonit.com$url")
            }

            // Add extras for fallback navigation
            putExtra("notification_type", type)
            targetId?.let { putExtra("target_id", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val priority = when (severity.lowercase()) {
            "high", "critical" -> NotificationCompat.PRIORITY_HIGH
            "medium", "warning" -> NotificationCompat.PRIORITY_DEFAULT
            else -> NotificationCompat.PRIORITY_LOW
        }

        val smallIconRes = android.R.drawable.ic_dialog_info

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(smallIconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(priority)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(
                when (severity.lowercase()) {
                    "high", "critical" -> NotificationCompat.CATEGORY_ALARM
                    else -> NotificationCompat.CATEGORY_MESSAGE
                }
            )
            .setGroup("algo_notifications")
            .build()

        try {
            NotificationManagerCompat.from(this).notify(notificationId, notification)
        } catch (_: SecurityException) {
            // Notification permission not granted - silently ignore
        }
    }

    private fun registerDeviceToken(token: String) {
        serviceScope.launch {
            try {
                httpClient.post("/devices/register") {
                    contentType(ContentType.Application.Json)
                    setBody(
                        DeviceRegistration(
                            deviceId = getDeviceId(),
                            deviceType = "android",
                            pushToken = token,
                            appVersion = getAppVersion(),
                            osVersion = "Android ${android.os.Build.VERSION.RELEASE}"
                        )
                    )
                }
            } catch (_: Exception) {
                // Token registration failed - will retry on next app launch
            }
        }
    }

    private fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: "unknown_device"
    }

    private fun getAppVersion(): String {
        return try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "1.0.0"
        } catch (_: Exception) {
            "1.0.0"
        }
    }

    @Serializable
    private data class DeviceRegistration(
        @kotlinx.serialization.SerialName("device_id") val deviceId: String,
        @kotlinx.serialization.SerialName("device_type") val deviceType: String,
        @kotlinx.serialization.SerialName("push_token") val pushToken: String,
        @kotlinx.serialization.SerialName("app_version") val appVersion: String,
        @kotlinx.serialization.SerialName("os_version") val osVersion: String
    )
}
