package com.algonit.algo.features.chat.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * A suggested follow-up action that the assistant can propose to the user.
 * These appear as tappable chips below the assistant's response.
 *
 * @property label Human-readable text displayed on the action chip.
 * @property action Machine-readable action identifier (e.g., "VIEW_REPORT", "CONFIRM_ACTION").
 * @property params Optional key-value parameters for the action, serialized as a JSON object.
 */
@Serializable
data class SuggestedAction(
    val label: String,
    val action: String,
    val params: JsonObject? = null
)
