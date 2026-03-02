package com.algonit.algo.features.chat.presentation.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.algonit.algo.features.chat.data.model.SuggestedAction

/**
 * A horizontal scrollable row of suggested action chips.
 *
 * Displayed below the assistant's response to provide quick
 * follow-up actions the user can tap instead of typing.
 *
 * @param actions List of suggested actions to display.
 * @param onActionClick Callback when a chip is tapped.
 */
@Composable
fun SuggestedActionsBar(
    actions: List<SuggestedAction>,
    onActionClick: (SuggestedAction) -> Unit,
    modifier: Modifier = Modifier
) {
    if (actions.isEmpty()) return

    LazyRow(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(
            items = actions,
            key = { "${it.action}_${it.label}" }
        ) { action ->
            AssistChip(
                onClick = { onActionClick(action) },
                label = {
                    Text(
                        text = action.label,
                        style = MaterialTheme.typography.labelMedium
                    )
                },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    labelColor = MaterialTheme.colorScheme.onSecondaryContainer
                ),
                border = null
            )
        }
    }
}
