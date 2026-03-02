package com.algonit.algo.core.storage

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "algo_preferences")

@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.dataStore

    // Theme
    val theme: Flow<AppTheme>
        get() = dataStore.data.map { prefs ->
            when (prefs[Keys.THEME]) {
                "light" -> AppTheme.LIGHT
                "dark" -> AppTheme.DARK
                else -> AppTheme.SYSTEM
            }
        }

    suspend fun setTheme(theme: AppTheme) {
        dataStore.edit { prefs ->
            prefs[Keys.THEME] = theme.value
        }
    }

    // Notification Toggles
    val alertsEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.ALERTS_ENABLED] ?: true
        }

    suspend fun setAlertsEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.ALERTS_ENABLED] = enabled
        }
    }

    val messageNotificationsEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.MESSAGE_NOTIFICATIONS_ENABLED] ?: true
        }

    suspend fun setMessageNotificationsEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.MESSAGE_NOTIFICATIONS_ENABLED] = enabled
        }
    }

    val actionConfirmationsEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.ACTION_CONFIRMATIONS_ENABLED] ?: true
        }

    suspend fun setActionConfirmationsEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.ACTION_CONFIRMATIONS_ENABLED] = enabled
        }
    }

    // Onboarding
    val hasCompletedOnboarding: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.ONBOARDING_COMPLETED] ?: false
        }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.ONBOARDING_COMPLETED] = completed
        }
    }

    // Voice Settings
    val voiceInputEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.VOICE_INPUT_ENABLED] ?: true
        }

    suspend fun setVoiceInputEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.VOICE_INPUT_ENABLED] = enabled
        }
    }

    val voiceOutputEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.VOICE_OUTPUT_ENABLED] ?: false
        }

    suspend fun setVoiceOutputEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.VOICE_OUTPUT_ENABLED] = enabled
        }
    }

    val voiceSpeed: Flow<Float>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.VOICE_SPEED] ?: 1.0f
        }

    suspend fun setVoiceSpeed(speed: Float) {
        dataStore.edit { prefs ->
            prefs[Keys.VOICE_SPEED] = speed.coerceIn(0.5f, 2.0f)
        }
    }

    val selectedVoice: Flow<String>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.SELECTED_VOICE] ?: "alloy"
        }

    suspend fun setSelectedVoice(voice: String) {
        dataStore.edit { prefs ->
            prefs[Keys.SELECTED_VOICE] = voice
        }
    }

    // Haptic Feedback
    val hapticFeedbackEnabled: Flow<Boolean>
        get() = dataStore.data.map { prefs ->
            prefs[Keys.HAPTIC_FEEDBACK_ENABLED] ?: true
        }

    suspend fun setHapticFeedbackEnabled(enabled: Boolean) {
        dataStore.edit { prefs ->
            prefs[Keys.HAPTIC_FEEDBACK_ENABLED] = enabled
        }
    }

    suspend fun clearAll() {
        dataStore.edit { it.clear() }
    }

    private object Keys {
        val THEME = stringPreferencesKey("theme")
        val ALERTS_ENABLED = booleanPreferencesKey("alerts_enabled")
        val MESSAGE_NOTIFICATIONS_ENABLED = booleanPreferencesKey("message_notifications_enabled")
        val ACTION_CONFIRMATIONS_ENABLED = booleanPreferencesKey("action_confirmations_enabled")
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        val VOICE_INPUT_ENABLED = booleanPreferencesKey("voice_input_enabled")
        val VOICE_OUTPUT_ENABLED = booleanPreferencesKey("voice_output_enabled")
        val VOICE_SPEED = floatPreferencesKey("voice_speed")
        val SELECTED_VOICE = stringPreferencesKey("selected_voice")
        val HAPTIC_FEEDBACK_ENABLED = booleanPreferencesKey("haptic_feedback_enabled")
    }
}

enum class AppTheme(val value: String) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark")
}
