package com.algonit.algo.features.chat.presentation.components

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.algonit.algo.core.audio.SpeechRecognizerManager

/**
 * Voice input button that toggles speech recognition on/off.
 *
 * Features:
 * - Pulsing scale animation while actively listening
 * - Color change between idle (surface) and recording (error/red)
 * - Automatic microphone permission request
 * - Calls [onTranscription] with the final recognized text
 *
 * @param onTranscription Callback invoked with the recognized speech text.
 * @param enabled Whether the button is interactive.
 */
@Composable
fun VoiceInputButton(
    onTranscription: (String) -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var isRecording by remember { mutableStateOf(false) }
    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val speechRecognizer = remember { SpeechRecognizerManager(context) }

    // Permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasPermission = granted
        if (granted) {
            startRecording(speechRecognizer, onTranscription) { isRecording = it }
        }
    }

    // Pulsing animation while recording
    val infiniteTransition = rememberInfiniteTransition(label = "voice_pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse_scale"
    )

    // Button color animation
    val containerColor by animateColorAsState(
        targetValue = if (isRecording) {
            MaterialTheme.colorScheme.error
        } else {
            MaterialTheme.colorScheme.surfaceVariant
        },
        animationSpec = tween(durationMillis = 200),
        label = "mic_color"
    )

    val iconTint by animateColorAsState(
        targetValue = if (isRecording) {
            MaterialTheme.colorScheme.onError
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        },
        animationSpec = tween(durationMillis = 200),
        label = "icon_tint"
    )

    // Cleanup on dispose
    DisposableEffect(Unit) {
        onDispose {
            speechRecognizer.destroy()
        }
    }

    IconButton(
        onClick = {
            if (!enabled) return@IconButton

            if (isRecording) {
                speechRecognizer.stopListening()
                isRecording = false
            } else {
                if (hasPermission) {
                    startRecording(speechRecognizer, onTranscription) { isRecording = it }
                } else {
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        },
        modifier = modifier
            .size(48.dp)
            .then(
                if (isRecording) Modifier.scale(pulseScale) else Modifier
            ),
        enabled = enabled,
        colors = IconButtonDefaults.iconButtonColors(
            containerColor = containerColor
        )
    ) {
        Icon(
            imageVector = if (isRecording) Icons.Default.MicOff else Icons.Default.Mic,
            contentDescription = if (isRecording) "Stop recording" else "Start voice input",
            tint = iconTint,
            modifier = Modifier.size(24.dp)
        )
    }
}

/**
 * Starts speech recognition and wires up callbacks.
 */
private fun startRecording(
    speechRecognizer: SpeechRecognizerManager,
    onTranscription: (String) -> Unit,
    onRecordingState: (Boolean) -> Unit
) {
    onRecordingState(true)
    speechRecognizer.startListening(
        onResult = { text ->
            onRecordingState(false)
            if (text.isNotBlank()) {
                onTranscription(text)
            }
        }
    )
}
