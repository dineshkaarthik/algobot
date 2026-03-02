package com.algonit.algo.core.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SecureStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val prefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_ACCESS_TOKEN, token).apply()
    }

    fun getToken(): String? {
        return prefs.getString(KEY_ACCESS_TOKEN, null)
    }

    fun saveRefreshToken(token: String) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, token).apply()
    }

    fun getRefreshToken(): String? {
        return prefs.getString(KEY_REFRESH_TOKEN, null)
    }

    fun saveTenantId(tenantId: String) {
        prefs.edit().putString(KEY_TENANT_ID, tenantId).apply()
    }

    fun getTenantId(): String? {
        return prefs.getString(KEY_TENANT_ID, null)
    }

    fun saveUserId(userId: String) {
        prefs.edit().putString(KEY_USER_ID, userId).apply()
    }

    fun getUserId(): String? {
        return prefs.getString(KEY_USER_ID, null)
    }

    fun saveTokenExpiry(expiryMillis: Long) {
        prefs.edit().putLong(KEY_TOKEN_EXPIRY, expiryMillis).apply()
    }

    /**
     * Convenience overload that accepts expires_in seconds from the API
     * and converts to an absolute expiry timestamp.
     */
    fun saveTokenExpiry(expiresInSeconds: Int) {
        val expiryMillis = System.currentTimeMillis() + (expiresInSeconds * 1000L)
        saveTokenExpiry(expiryMillis)
    }

    fun getTokenExpiry(): Long {
        return prefs.getLong(KEY_TOKEN_EXPIRY, 0L)
    }

    fun isTokenExpired(): Boolean {
        val expiry = getTokenExpiry()
        if (expiry == 0L) return true
        return System.currentTimeMillis() >= expiry - TOKEN_EXPIRY_BUFFER_MS
    }

    fun saveUserJson(userJson: String) {
        prefs.edit().putString(KEY_USER_JSON, userJson).apply()
    }

    fun getUserJson(): String? {
        return prefs.getString(KEY_USER_JSON, null)
    }

    fun setBiometricEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, enabled).apply()
    }

    fun isBiometricEnabled(): Boolean {
        return prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false)
    }

    fun hasTokens(): Boolean {
        return getToken() != null && getRefreshToken() != null
    }

    fun clearAll() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_FILE_NAME = "algo_secure_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_TENANT_ID = "tenant_id"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_TOKEN_EXPIRY = "token_expiry"
        private const val KEY_USER_JSON = "user_json"
        private const val KEY_BIOMETRIC_ENABLED = "biometric_enabled"
        private const val TOKEN_EXPIRY_BUFFER_MS = 60_000L // Refresh 1 minute before expiry
    }
}
