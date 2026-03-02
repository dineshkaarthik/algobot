package com.algonit.algo.features.dashboard.presentation.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.algonit.algo.ui.theme.AlgoBlue
import com.algonit.algo.ui.theme.AlgoGreen
import com.algonit.algo.ui.theme.AlgoOrange
import com.algonit.algo.ui.theme.AlgoPurple

data class QuickAction(
    val label: String,
    val icon: ImageVector,
    val color: Color,
    val onClick: () -> Unit
)

@Composable
fun QuickActionsGrid(
    onNewChat: () -> Unit,
    onViewLeads: () -> Unit,
    onViewCampaigns: () -> Unit,
    onViewCredits: () -> Unit,
    modifier: Modifier = Modifier
) {
    val actions = listOf(
        QuickAction(
            label = "New Chat",
            icon = Icons.Default.ChatBubble,
            color = AlgoBlue,
            onClick = onNewChat
        ),
        QuickAction(
            label = "View Leads",
            icon = Icons.Default.People,
            color = AlgoGreen,
            onClick = onViewLeads
        ),
        QuickAction(
            label = "Campaigns",
            icon = Icons.Default.Campaign,
            color = AlgoPurple,
            onClick = onViewCampaigns
        ),
        QuickAction(
            label = "Credits",
            icon = Icons.Default.CreditCard,
            color = AlgoOrange,
            onClick = onViewCredits
        )
    )

    Column(modifier = modifier.fillMaxWidth()) {
        // 2x2 grid
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            QuickActionTile(
                action = actions[0],
                modifier = Modifier.weight(1f)
            )
            QuickActionTile(
                action = actions[1],
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            QuickActionTile(
                action = actions[2],
                modifier = Modifier.weight(1f)
            )
            QuickActionTile(
                action = actions[3],
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun QuickActionTile(
    action: QuickAction,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .clickable(onClick = action.onClick),
        colors = CardDefaults.cardColors(
            containerColor = action.color.copy(alpha = 0.1f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        shape = MaterialTheme.shapes.medium
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = action.icon,
                contentDescription = action.label,
                tint = action.color,
                modifier = Modifier.size(28.dp)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = action.label,
                style = MaterialTheme.typography.labelLarge,
                color = action.color,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
