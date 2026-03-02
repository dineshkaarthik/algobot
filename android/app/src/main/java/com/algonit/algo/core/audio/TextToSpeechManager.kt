package com.algonit.algo.core.audio

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages Android's TextToSpeech engine for voice output.
 *
 * Provides reactive state via StateFlows for speaking status and engine readiness.
 * Supports speech rate control, language selection, and utterance tracking.
 */
@Singleton
class TextToSpeechManager @Inject constructor(
    @ApplicationContext private val context: Context
) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = null

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    private val _isReady = MutableStateFlow(false)
    val isReady: StateFlow<Boolean> = _isReady.asStateFlow()

    private val _error = MutableStateFlow<TtsError?>(null)
    val error: StateFlow<TtsError?> = _error.asStateFlow()

    private var speechRate: Float = 1.0f
    private var currentUtteranceId: String? = null
    private var onCompleteCallback: (() -> Unit)? = null

    init {
        initialize()
    }

    /**
     * Initializes the TTS engine. Called automatically at creation.
     */
    private fun initialize() {
        tts = TextToSpeech(context, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale.US)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                _error.value = TtsError.LANGUAGE_NOT_SUPPORTED
                _isReady.value = false
            } else {
                _isReady.value = true
                _error.value = null
                setupUtteranceListener()
            }
        } else {
            _isReady.value = false
            _error.value = TtsError.INIT_FAILED
        }
    }

    private fun setupUtteranceListener() {
        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                _isSpeaking.value = true
            }

            override fun onDone(utteranceId: String?) {
                _isSpeaking.value = false
                if (utteranceId == currentUtteranceId) {
                    onCompleteCallback?.invoke()
                    onCompleteCallback = null
                }
            }

            @Deprecated("Deprecated in API level 21")
            override fun onError(utteranceId: String?) {
                _isSpeaking.value = false
                _error.value = TtsError.SYNTHESIS_ERROR
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                _isSpeaking.value = false
                _error.value = TtsError.fromCode(errorCode)
            }

            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                _isSpeaking.value = false
            }
        })
    }

    /**
     * Speaks the given text aloud.
     *
     * @param text The text to speak
     * @param onComplete Optional callback invoked when speech finishes
     * @param queueMode Whether to queue after current speech or flush and replace
     */
    fun speak(
        text: String,
        onComplete: (() -> Unit)? = null,
        queueMode: Int = TextToSpeech.QUEUE_FLUSH
    ) {
        if (!_isReady.value) {
            _error.value = TtsError.NOT_READY
            return
        }

        if (text.isBlank()) return

        onCompleteCallback = onComplete
        currentUtteranceId = UUID.randomUUID().toString()

        tts?.setSpeechRate(speechRate)
        tts?.speak(text, queueMode, null, currentUtteranceId)
    }

    /**
     * Speaks a list of text segments sequentially.
     */
    fun speakSequence(segments: List<String>, onAllComplete: (() -> Unit)? = null) {
        if (segments.isEmpty()) {
            onAllComplete?.invoke()
            return
        }

        segments.forEachIndexed { index, segment ->
            val mode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            val callback = if (index == segments.lastIndex) onAllComplete else null
            speak(segment, onComplete = callback, queueMode = mode)
        }
    }

    /**
     * Stops the current speech output immediately.
     */
    fun stop() {
        tts?.stop()
        _isSpeaking.value = false
        onCompleteCallback = null
    }

    /**
     * Sets the speech rate.
     *
     * @param rate Speech rate multiplier (0.5 = half speed, 2.0 = double speed)
     */
    fun setSpeechRate(rate: Float) {
        speechRate = rate.coerceIn(0.25f, 4.0f)
        tts?.setSpeechRate(speechRate)
    }

    /**
     * Sets the speech language.
     *
     * @param locale The locale to use for speech
     * @return true if the language is supported
     */
    fun setLanguage(locale: Locale): Boolean {
        val result = tts?.setLanguage(locale)
        return result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
    }

    /**
     * Returns the list of available TTS voices on this device.
     */
    fun getAvailableVoices(): List<String> {
        return tts?.voices?.map { it.name } ?: emptyList()
    }

    /**
     * Releases all TTS resources. Call when the manager is no longer needed.
     */
    fun shutdown() {
        stop()
        tts?.shutdown()
        tts = null
        _isReady.value = false
        _isSpeaking.value = false
    }
}

/**
 * TTS error types.
 */
enum class TtsError(val message: String) {
    INIT_FAILED("Text-to-speech engine failed to initialize"),
    NOT_READY("Text-to-speech engine is not ready"),
    LANGUAGE_NOT_SUPPORTED("The selected language is not supported"),
    SYNTHESIS_ERROR("Error during speech synthesis"),
    NETWORK_ERROR("Network error during synthesis"),
    OUTPUT_ERROR("Audio output error"),
    UNKNOWN("Unknown text-to-speech error");

    companion object {
        fun fromCode(errorCode: Int): TtsError = when (errorCode) {
            TextToSpeech.ERROR_NETWORK,
            TextToSpeech.ERROR_NETWORK_TIMEOUT -> NETWORK_ERROR
            TextToSpeech.ERROR_OUTPUT -> OUTPUT_ERROR
            TextToSpeech.ERROR_SYNTHESIS -> SYNTHESIS_ERROR
            TextToSpeech.ERROR_NOT_INSTALLED_YET -> INIT_FAILED
            else -> UNKNOWN
        }
    }
}
