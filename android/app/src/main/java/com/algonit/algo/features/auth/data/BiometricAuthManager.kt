package com.algonit.algo.features.auth.data

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Manages biometric authentication for the app.
 * Encapsulates BiometricPrompt setup, availability checks,
 * and provides a coroutine-friendly authentication API.
 */
@Singleton
class BiometricAuthManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    /**
     * Whether strong biometric authentication (fingerprint, face) is available
     * and enrolled on this device.
     */
    val isBiometricAvailable: Boolean
        get() {
            val manager = BiometricManager.from(context)
            return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS
        }

    /**
     * Presents the biometric authentication prompt and suspends until the user
     * succeeds, cancels, or exhausts all retries.
     *
     * @param activity The FragmentActivity required by BiometricPrompt.
     * @return true if authentication succeeded, false otherwise.
     */
    suspend fun authenticate(activity: FragmentActivity): Boolean =
        suspendCancellableCoroutine { cont ->
            val executor = ContextCompat.getMainExecutor(context)
            val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (cont.isActive) cont.resume(true)
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (cont.isActive) cont.resume(false)
                }
                override fun onAuthenticationFailed() {
                    // Don't resume yet -- user can retry within the BiometricPrompt UI
                }
            })
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock Algo")
                .setSubtitle("Authenticate to access your business data")
                .setNegativeButtonText("Use Password")
                .build()
            prompt.authenticate(info)
        }
}
