package com.algonit.algo.features.auth.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * User profile data returned from the authentication API.
 */
@Serializable
data class User(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    @SerialName("tenant_id") val tenantId: String,
    @SerialName("avatar_url") val avatarUrl: String? = null
) {
    /**
     * Returns the parsed [UserRole] for this user, defaulting to [UserRole.VIEWER]
     * if the role string is unrecognized.
     */
    val userRole: UserRole
        get() = UserRole.fromString(role)
}

/**
 * Enumeration of user roles in the Algonit platform.
 * Each role has a display-friendly name for use in the UI.
 */
enum class UserRole(val displayName: String) {
    ADMIN("Admin"),
    MANAGER("Manager"),
    MEMBER("Member"),
    VIEWER("Viewer");

    companion object {
        /**
         * Parses a role string (case-insensitive) into a [UserRole].
         * Returns [VIEWER] if the string does not match any known role.
         */
        fun fromString(value: String): UserRole {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: VIEWER
        }
    }
}
