package com.algonit.algo.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.sin

private const val BAR_COUNT = 5
private const val MIN_HEIGHT_FRACTION = 0.2f
private const val MAX_HEIGHT_FRACTION = 1.0f

@Composable
fun AnimatedWaveform(
    isActive: Boolean,
    modifier: Modifier = Modifier,
    barColor: Color = MaterialTheme.colorScheme.primary,
    barWidth: Dp = 4.dp,
    barSpacing: Dp = 3.dp,
    height: Dp = 32.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "waveform")

    val phase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 2f * Math.PI.toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "waveformPhase"
    )

    val pulse by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 600, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "waveformPulse"
    )

    val totalWidth = (barWidth * BAR_COUNT) + (barSpacing * (BAR_COUNT - 1))

    Canvas(
        modifier = modifier
            .width(totalWidth)
            .height(height)
    ) {
        val canvasHeight = size.height
        val barWidthPx = barWidth.toPx()
        val barSpacingPx = barSpacing.toPx()
        val cornerRadiusPx = barWidthPx / 2f

        for (i in 0 until BAR_COUNT) {
            val heightFraction = if (isActive) {
                val offset = i.toFloat() / BAR_COUNT * Math.PI.toFloat() * 2f
                val sinValue = sin(phase + offset)
                val normalized = (sinValue + 1f) / 2f
                (MIN_HEIGHT_FRACTION + normalized * (MAX_HEIGHT_FRACTION - MIN_HEIGHT_FRACTION)) * pulse
            } else {
                MIN_HEIGHT_FRACTION
            }

            val barHeight = canvasHeight * heightFraction
            val x = i * (barWidthPx + barSpacingPx)
            val y = (canvasHeight - barHeight) / 2f

            drawRoundRect(
                color = barColor.copy(alpha = if (isActive) 1f else 0.4f),
                topLeft = Offset(x, y),
                size = Size(barWidthPx, barHeight),
                cornerRadius = CornerRadius(cornerRadiusPx, cornerRadiusPx)
            )
        }
    }
}
