package com.algonit.algo.core.audio

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages Android's SpeechRecognizer for voice input.
 *
 * Provides reactive state via StateFlows for transcript text, listening state,
 * and audio RMS level. Supports partial results for real-time transcript updates.
 */
@Singleton
class SpeechRecognizerManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var speechRecognizer: SpeechRecognizer? = null

    private val _transcript = MutableStateFlow("")
    val transcript: StateFlow<String> = _transcript.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    private val _rmsLevel = MutableStateFlow(0f)
    val rmsLevel: StateFlow<Float> = _rmsLevel.asStateFlow()

    private val _error = MutableStateFlow<SpeechError?>(null)
    val error: StateFlow<SpeechError?> = _error.asStateFlow()

    private var onResultCallback: ((String) -> Unit)? = null
    private var onErrorCallback: ((SpeechError) -> Unit)? = null

    /**
     * Returns true if speech recognition is available on this device.
     */
    fun isAvailable(): Boolean {
        return SpeechRecognizer.isRecognitionAvailable(context)
    }

    /**
     * Starts listening for speech input.
     *
     * @param onResult Optional callback invoked with the final recognized text
     * @param onError Optional callback invoked on recognition error
     * @param language Language locale to use (defaults to device locale)
     */
    fun startListening(
        onResult: ((String) -> Unit)? = null,
        onError: ((SpeechError) -> Unit)? = null,
        language: Locale = Locale.getDefault()
    ) {
        if (!isAvailable()) {
            val err = SpeechError.NOT_AVAILABLE
            _error.value = err
            onError?.invoke(err)
            return
        }

        if (_isListening.value) {
            stopListening()
        }

        onResultCallback = onResult
        onErrorCallback = onError
        _transcript.value = ""
        _error.value = null

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(createRecognitionListener())
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1000L)
        }

        speechRecognizer?.startListening(intent)
    }

    /**
     * Stops the current listening session.
     */
    fun stopListening() {
        speechRecognizer?.stopListening()
        _isListening.value = false
    }

    /**
     * Cancels the current recognition without producing results.
     */
    fun cancel() {
        speechRecognizer?.cancel()
        _isListening.value = false
        _transcript.value = ""
    }

    /**
     * Releases all resources. Call when the manager is no longer needed.
     */
    fun destroy() {
        speechRecognizer?.destroy()
        speechRecognizer = null
        onResultCallback = null
        onErrorCallback = null
        _isListening.value = false
        _transcript.value = ""
        _rmsLevel.value = 0f
        _error.value = null
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                _isListening.value = true
                _error.value = null
            }

            override fun onBeginningOfSpeech() {
                // User has started speaking
            }

            override fun onRmsChanged(rmsdB: Float) {
                _rmsLevel.value = rmsdB.coerceIn(0f, 12f)
            }

            override fun onBufferReceived(buffer: ByteArray?) {
                // Raw audio buffer -- not used
            }

            override fun onEndOfSpeech() {
                _isListening.value = false
            }

            override fun onError(errorCode: Int) {
                _isListening.value = false
                val speechError = SpeechError.fromCode(errorCode)
                _error.value = speechError
                onErrorCallback?.invoke(speechError)
            }

            override fun onResults(results: Bundle?) {
                val matches = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull() ?: ""
                _transcript.value = text
                _isListening.value = false
                onResultCallback?.invoke(text)
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val partialText = matches?.firstOrNull() ?: return
                _transcript.value = partialText
            }

            override fun onEvent(eventType: Int, params: Bundle?) {
                // Reserved for future use
            }
        }
    }
}

/**
 * Speech recognition error types.
 */
enum class SpeechError(val message: String) {
    NOT_AVAILABLE("Speech recognition is not available on this device"),
    AUDIO_ERROR("Audio recording error"),
    NETWORK_ERROR("Network error during recognition"),
    NO_MATCH("No speech was recognized"),
    RECOGNIZER_BUSY("Recognition service is busy"),
    INSUFFICIENT_PERMISSIONS("Microphone permission not granted"),
    SERVER_ERROR("Server-side recognition error"),
    TIMEOUT("No speech input detected"),
    UNKNOWN("Unknown recognition error");

    companion object {
        fun fromCode(errorCode: Int): SpeechError = when (errorCode) {
            SpeechRecognizer.ERROR_AUDIO -> AUDIO_ERROR
            SpeechRecognizer.ERROR_NETWORK,
            SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> NETWORK_ERROR
            SpeechRecognizer.ERROR_NO_MATCH,
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> NO_MATCH
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> RECOGNIZER_BUSY
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> INSUFFICIENT_PERMISSIONS
            SpeechRecognizer.ERROR_SERVER -> SERVER_ERROR
            else -> UNKNOWN
        }
    }
}
