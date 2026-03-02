package com.algonit.algo.ui.theme

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Available theme modes for the application.
 */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

private val Context.themeDataStore by preferencesDataStore("theme_prefs")
private val THEME_KEY = stringPreferencesKey("theme_mode")

/**
 * Manages the user's theme preference using Jetpack DataStore.
 * Exposes a reactive [Flow] of the current [ThemeMode] and provides
 * a suspend function to persist changes.
 */
@Singleton
class DarkModeManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    /**
     * Emits the currently selected [ThemeMode], defaulting to [ThemeMode.SYSTEM]
     * when no preference has been saved.
     */
    val themeMode: Flow<ThemeMode> = context.themeDataStore.data.map { prefs ->
        try {
            ThemeMode.valueOf(prefs[THEME_KEY] ?: ThemeMode.SYSTEM.name)
        } catch (_: IllegalArgumentException) {
            ThemeMode.SYSTEM
        }
    }

    /**
     * Persists the given [ThemeMode] to DataStore.
     */
    suspend fun setThemeMode(mode: ThemeMode) {
        context.themeDataStore.edit { it[THEME_KEY] = mode.name }
    }
}
