package com.algonit.algo.ui.components

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.algonit.algo.ui.theme.AlgoRed

enum class AlgoButtonStyle {
    Primary,
    Secondary,
    Destructive,
    Ghost
}

@Composable
fun AlgoButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: AlgoButtonStyle = AlgoButtonStyle.Primary,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    icon: ImageVector? = null
) {
    val content: @Composable () -> Unit = {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = when (style) {
                    AlgoButtonStyle.Primary, AlgoButtonStyle.Destructive ->
                        MaterialTheme.colorScheme.onPrimary
                    AlgoButtonStyle.Secondary -> MaterialTheme.colorScheme.primary
                    AlgoButtonStyle.Ghost -> MaterialTheme.colorScheme.primary
                }
            )
            Spacer(modifier = Modifier.width(8.dp))
        } else if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        Text(text = text)
    }

    when (style) {
        AlgoButtonStyle.Primary -> {
            Button(
                onClick = onClick,
                modifier = modifier,
                enabled = enabled && !isLoading,
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                shape = MaterialTheme.shapes.medium,
                content = { content() }
            )
        }

        AlgoButtonStyle.Secondary -> {
            OutlinedButton(
                onClick = onClick,
                modifier = modifier,
                enabled = enabled && !isLoading,
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                shape = MaterialTheme.shapes.medium,
                content = { content() }
            )
        }

        AlgoButtonStyle.Destructive -> {
            Button(
                onClick = onClick,
                modifier = modifier,
                enabled = enabled && !isLoading,
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = AlgoRed,
                    contentColor = Color.White
                ),
                content = { content() }
            )
        }

        AlgoButtonStyle.Ghost -> {
            TextButton(
                onClick = onClick,
                modifier = modifier,
                enabled = enabled && !isLoading,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                shape = MaterialTheme.shapes.medium,
                content = { content() }
            )
        }
    }
}
