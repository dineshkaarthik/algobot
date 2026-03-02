package com.algonit.algo.core.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Records audio to a temporary .m4a file using MediaRecorder.
 *
 * Features:
 * - Records AAC-encoded audio in MPEG-4 container
 * - Maximum recording duration of 60 seconds (auto-stops)
 * - Reactive state via StateFlows for recording status, elapsed duration, and amplitude
 * - Returns the recorded [File] for upload to the backend
 */
@Singleton
class AudioRecorder @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private var mediaRecorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var timerJob: Job? = null

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording.asStateFlow()

    private val _durationSeconds = MutableStateFlow(0)
    val durationSeconds: StateFlow<Int> = _durationSeconds.asStateFlow()

    private val _amplitude = MutableStateFlow(0)
    val amplitude: StateFlow<Int> = _amplitude.asStateFlow()

    private val _error = MutableStateFlow<RecorderError?>(null)
    val error: StateFlow<RecorderError?> = _error.asStateFlow()

    companion object {
        const val MAX_DURATION_SECONDS = 60
        private const val AUDIO_SAMPLE_RATE = 44100
        private const val AUDIO_BIT_RATE = 128000
        private const val AMPLITUDE_POLL_INTERVAL_MS = 100L
    }

    /**
     * Starts recording audio to a temporary .m4a file.
     *
     * @param onMaxDurationReached Optional callback when the 60-second limit is hit
     * @return true if recording started successfully
     */
    fun startRecording(onMaxDurationReached: (() -> Unit)? = null): Boolean {
        if (_isRecording.value) return false

        _error.value = null
        _durationSeconds.value = 0
        _amplitude.value = 0

        val file = createOutputFile() ?: run {
            _error.value = RecorderError.FILE_CREATION_FAILED
            return false
        }
        outputFile = file

        try {
            mediaRecorder = createMediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(AUDIO_SAMPLE_RATE)
                setAudioEncodingBitRate(AUDIO_BIT_RATE)
                setMaxDuration(MAX_DURATION_SECONDS * 1000)
                setOutputFile(file.absolutePath)

                setOnInfoListener { _, what, _ ->
                    if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) {
                        stopRecording()
                        onMaxDurationReached?.invoke()
                    }
                }

                setOnErrorListener { _, what, _ ->
                    _error.value = RecorderError.fromMediaRecorderError(what)
                    stopRecording()
                }

                prepare()
                start()
            }

            _isRecording.value = true
            startTimer(onMaxDurationReached)
            return true
        } catch (e: IOException) {
            _error.value = RecorderError.PREPARATION_FAILED
            cleanup()
            return false
        } catch (e: SecurityException) {
            _error.value = RecorderError.PERMISSION_DENIED
            cleanup()
            return false
        } catch (e: Exception) {
            _error.value = RecorderError.UNKNOWN
            cleanup()
            return false
        }
    }

    /**
     * Stops the current recording and returns the recorded audio file.
     *
     * @return The recorded .m4a [File], or null if no recording was in progress
     */
    fun stopRecording(): File? {
        if (!_isRecording.value) return outputFile

        timerJob?.cancel()
        timerJob = null

        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
        } catch (e: RuntimeException) {
            // Recording was too short or already stopped
            _error.value = RecorderError.RECORDING_TOO_SHORT
        }

        mediaRecorder = null
        _isRecording.value = false
        _amplitude.value = 0

        return outputFile
    }

    /**
     * Cancels the current recording and deletes the output file.
     */
    fun cancelRecording() {
        timerJob?.cancel()
        timerJob = null

        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
        } catch (_: RuntimeException) {
            // Ignore errors during cancel
        }

        mediaRecorder = null
        _isRecording.value = false
        _durationSeconds.value = 0
        _amplitude.value = 0

        outputFile?.delete()
        outputFile = null
    }

    /**
     * Returns the current amplitude level (0 to ~32767).
     * Useful for visualizing audio waveform during recording.
     */
    fun getCurrentAmplitude(): Int {
        return try {
            mediaRecorder?.maxAmplitude ?: 0
        } catch (_: Exception) {
            0
        }
    }

    /**
     * Deletes a previously recorded file.
     */
    fun deleteRecording(file: File) {
        file.delete()
    }

    /**
     * Releases all resources. Call when the recorder is no longer needed.
     */
    fun release() {
        cancelRecording()
    }

    @Suppress("DEPRECATION")
    private fun createMediaRecorder(): MediaRecorder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            MediaRecorder()
        }
    }

    private fun createOutputFile(): File? {
        return try {
            val cacheDir = context.cacheDir
            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            File(cacheDir, "algo_audio_${timestamp}.m4a").also { file ->
                if (file.exists()) file.delete()
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun startTimer(onMaxDurationReached: (() -> Unit)?) {
        timerJob = CoroutineScope(Dispatchers.Default).launch {
            while (isActive && _isRecording.value) {
                delay(1000L)
                if (!_isRecording.value) break

                val elapsed = _durationSeconds.value + 1
                _durationSeconds.value = elapsed

                // Poll amplitude
                _amplitude.value = getCurrentAmplitude()

                if (elapsed >= MAX_DURATION_SECONDS) {
                    stopRecording()
                    onMaxDurationReached?.invoke()
                    break
                }
            }
        }
    }

    private fun cleanup() {
        mediaRecorder?.release()
        mediaRecorder = null
        outputFile?.delete()
        outputFile = null
        _isRecording.value = false
    }
}

/**
 * Audio recorder error types.
 */
enum class RecorderError(val message: String) {
    PERMISSION_DENIED("Microphone permission is required to record audio"),
    FILE_CREATION_FAILED("Failed to create audio file"),
    PREPARATION_FAILED("Failed to prepare the audio recorder"),
    RECORDING_TOO_SHORT("Recording was too short"),
    HARDWARE_ERROR("Audio hardware error"),
    UNKNOWN("Unknown recording error");

    companion object {
        fun fromMediaRecorderError(what: Int): RecorderError = when (what) {
            MediaRecorder.MEDIA_ERROR_SERVER_DIED -> HARDWARE_ERROR
            else -> UNKNOWN
        }
    }
}
