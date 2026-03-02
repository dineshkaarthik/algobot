package com.algonit.algo.features.settings.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.algonit.algo.ui.components.AlgoButton
import com.algonit.algo.ui.components.AlgoButtonStyle
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationPreferencesScreen(
    viewModel: SettingsViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Local state for editing
    var settings by remember(uiState.notificationSettings) {
        mutableStateOf(uiState.notificationSettings)
    }

    // Budget threshold slider
    var budgetThreshold by remember(settings.budgetAlert.thresholdPct) {
        mutableFloatStateOf((settings.budgetAlert.thresholdPct ?: 80).toFloat())
    }

    // Credit threshold slider
    var creditThreshold by remember(settings.creditLow.threshold) {
        mutableFloatStateOf((settings.creditLow.threshold ?: 500).toFloat())
    }

    LaunchedEffect(uiState.saveSuccess) {
        if (uiState.saveSuccess) {
            snackbarHostState.showSnackbar("Preferences saved")
            viewModel.dismissSaveSuccess()
        }
    }

    LaunchedEffect(uiState.error) {
        uiState.error?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.dismissError()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text(
                    text = "Notification Preferences",
                    style = MaterialTheme.typography.titleLarge
                )
            },
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back"
                    )
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.surface
            )
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Hot Lead Alerts
            AlertPreferenceCard(
                title = "Hot Lead Alerts",
                description = "Get notified when a high-scoring lead is detected",
                enabled = settings.hotLead.enabled,
                pushEnabled = settings.hotLead.push,
                emailEnabled = settings.hotLead.email,
                onEnabledChange = { enabled ->
                    settings = settings.copy(
                        hotLead = settings.hotLead.copy(enabled = enabled)
                    )
                },
                onPushChange = { push ->
                    settings = settings.copy(
                        hotLead = settings.hotLead.copy(push = push)
                    )
                },
                onEmailChange = { email ->
                    settings = settings.copy(
                        hotLead = settings.hotLead.copy(email = email)
                    )
                }
            )

            // Campaign Drop Alerts
            AlertPreferenceCard(
                title = "Campaign Performance Drop",
                description = "Alert when a campaign's metrics drop significantly",
                enabled = settings.campaignDrop.enabled,
                pushEnabled = settings.campaignDrop.push,
                emailEnabled = settings.campaignDrop.email,
                onEnabledChange = { enabled ->
                    settings = settings.copy(
                        campaignDrop = settings.campaignDrop.copy(enabled = enabled)
                    )
                },
                onPushChange = { push ->
                    settings = settings.copy(
                        campaignDrop = settings.campaignDrop.copy(push = push)
                    )
                },
                onEmailChange = { email ->
                    settings = settings.copy(
                        campaignDrop = settings.campaignDrop.copy(email = email)
                    )
                }
            )

            // Budget Alert with Threshold
            AlertPreferenceCard(
                title = "Budget Alert",
                description = "Warn when campaign budget usage exceeds threshold",
                enabled = settings.budgetAlert.enabled,
                pushEnabled = settings.budgetAlert.push,
                emailEnabled = settings.budgetAlert.email,
                onEnabledChange = { enabled ->
                    settings = settings.copy(
                        budgetAlert = settings.budgetAlert.copy(enabled = enabled)
                    )
                },
                onPushChange = { push ->
                    settings = settings.copy(
                        budgetAlert = settings.budgetAlert.copy(push = push)
                    )
                },
                onEmailChange = { email ->
                    settings = settings.copy(
                        budgetAlert = settings.budgetAlert.copy(email = email)
                    )
                },
                threshold = {
                    ThresholdSlider(
                        label = "Budget threshold",
                        value = budgetThreshold,
                        onValueChange = { budgetThreshold = it },
                        valueRange = 50f..100f,
                        steps = 9,
                        valueLabel = "${budgetThreshold.roundToInt()}%",
                        onValueChangeFinished = {
                            settings = settings.copy(
                                budgetAlert = settings.budgetAlert.copy(
                                    thresholdPct = budgetThreshold.roundToInt()
                                )
                            )
                        }
                    )
                }
            )

            // Revenue Spike
            AlertPreferenceCard(
                title = "Revenue Spike",
                description = "Notify on significant revenue increases",
                enabled = settings.revenueSpike.enabled,
                pushEnabled = settings.revenueSpike.push,
                emailEnabled = settings.revenueSpike.email,
                onEnabledChange = { enabled ->
                    settings = settings.copy(
                        revenueSpike = settings.revenueSpike.copy(enabled = enabled)
                    )
                },
                onPushChange = { push ->
                    settings = settings.copy(
                        revenueSpike = settings.revenueSpike.copy(push = push)
                    )
                },
                onEmailChange = { email ->
                    settings = settings.copy(
                        revenueSpike = settings.revenueSpike.copy(email = email)
                    )
                }
            )

            // Credit Low with Threshold
            AlertPreferenceCard(
                title = "AI Credits Low",
                description = "Alert when AI credits drop below threshold",
                enabled = settings.creditLow.enabled,
                pushEnabled = settings.creditLow.push,
                emailEnabled = settings.creditLow.email,
                onEnabledChange = { enabled ->
                    settings = settings.copy(
                        creditLow = settings.creditLow.copy(enabled = enabled)
                    )
                },
                onPushChange = { push ->
                    settings = settings.copy(
                        creditLow = settings.creditLow.copy(push = push)
                    )
                },
                onEmailChange = { email ->
                    settings = settings.copy(
                        creditLow = settings.creditLow.copy(email = email)
                    )
                },
                threshold = {
                    ThresholdSlider(
                        label = "Credit threshold",
                        value = creditThreshold,
                        onValueChange = { creditThreshold = it },
                        valueRange = 100f..2000f,
                        steps = 18,
                        valueLabel = "${creditThreshold.roundToInt()} credits",
                        onValueChangeFinished = {
                            settings = settings.copy(
                                creditLow = settings.creditLow.copy(
                                    threshold = creditThreshold.roundToInt()
                                )
                            )
                        }
                    )
                }
            )

            // Follow-up Overdue
            AlertPreferenceCard(
                title = "Follow-up Overdue",
                description = "Remind when lead follow-ups are overdue",
                enabled = settings.followupOverdue.enabled,
                pushEnabled = settings.followupOverdue.push,
                emailEnabled = settings.followupOverdue.email,
                onEnabledChange = { enabled ->
                    settings = settings.copy(
                        followupOverdue = settings.followupOverdue.copy(enabled = enabled)
                    )
                },
                onPushChange = { push ->
                    settings = settings.copy(
                        followupOverdue = settings.followupOverdue.copy(push = push)
                    )
                },
                onEmailChange = { email ->
                    settings = settings.copy(
                        followupOverdue = settings.followupOverdue.copy(email = email)
                    )
                }
            )

            Spacer(modifier = Modifier.height(8.dp))
        }

        // Save button
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            AlgoButton(
                text = "Save Preferences",
                onClick = { viewModel.updateNotificationSettings(settings) },
                style = AlgoButtonStyle.Primary,
                isLoading = uiState.isSaving,
                modifier = Modifier.fillMaxWidth()
            )
        }

        SnackbarHost(hostState = snackbarHostState)
    }
}

@Composable
private fun AlertPreferenceCard(
    title: String,
    description: String,
    enabled: Boolean,
    pushEnabled: Boolean,
    emailEnabled: Boolean,
    onEnabledChange: (Boolean) -> Unit,
    onPushChange: (Boolean) -> Unit,
    onEmailChange: (Boolean) -> Unit,
    threshold: @Composable (() -> Unit)? = null
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Main toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.SemiBold
                        ),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Switch(
                    checked = enabled,
                    onCheckedChange = onEnabledChange,
                    colors = SwitchDefaults.colors(
                        checkedTrackColor = MaterialTheme.colorScheme.primary,
                        checkedThumbColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }

            if (enabled) {
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 12.dp),
                    color = MaterialTheme.colorScheme.outlineVariant
                )

                // Sub-toggles
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    SubToggle(
                        label = "Push",
                        checked = pushEnabled,
                        onCheckedChange = onPushChange,
                        modifier = Modifier.weight(1f)
                    )
                    SubToggle(
                        label = "Email",
                        checked = emailEnabled,
                        onCheckedChange = onEmailChange,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Threshold slider (if applicable)
                threshold?.let {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 12.dp),
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                    it()
                }
            }
        }
    }
}

@Composable
private fun SubToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.width(8.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedTrackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f),
                checkedThumbColor = MaterialTheme.colorScheme.primary
            )
        )
    }
}

@Composable
private fun ThresholdSlider(
    label: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>,
    steps: Int,
    valueLabel: String,
    onValueChangeFinished: () -> Unit
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = valueLabel,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.SemiBold
                ),
                color = MaterialTheme.colorScheme.primary
            )
        }

        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            steps = steps,
            onValueChangeFinished = onValueChangeFinished,
            colors = SliderDefaults.colors(
                thumbColor = MaterialTheme.colorScheme.primary,
                activeTrackColor = MaterialTheme.colorScheme.primary
            )
        )
    }
}
