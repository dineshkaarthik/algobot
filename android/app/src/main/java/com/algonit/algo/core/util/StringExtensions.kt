package com.algonit.algo.core.util

import java.util.Locale
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.pow

/**
 * Validates that a string is a properly formatted email address.
 */
fun String.isValidEmail(): Boolean {
    if (isBlank()) return false
    val emailPattern = Regex(
        "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    )
    return emailPattern.matches(this.trim())
}

/**
 * Validates that a password meets minimum security requirements:
 * - At least 8 characters
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one digit
 * - Contains at least one special character
 */
fun String.isValidPassword(): Boolean {
    if (length < 8) return false
    val hasUppercase = any { it.isUpperCase() }
    val hasLowercase = any { it.isLowerCase() }
    val hasDigit = any { it.isDigit() }
    val hasSpecial = any { !it.isLetterOrDigit() }
    return hasUppercase && hasLowercase && hasDigit && hasSpecial
}

/**
 * Truncates the string to a maximum length, appending an ellipsis if truncated.
 */
fun String.truncate(maxLength: Int, ellipsis: String = "..."): String {
    if (length <= maxLength) return this
    if (maxLength <= ellipsis.length) return ellipsis.take(maxLength)
    return take(maxLength - ellipsis.length) + ellipsis
}

/**
 * Formats a number into a compact human-readable string.
 * Examples: 1234 -> "1.2K", 1500000 -> "1.5M", 999 -> "999"
 */
fun Number.compactNumber(): String {
    val value = this.toLong()
    if (abs(value) < 1000) return value.toString()

    val suffixes = charArrayOf(' ', 'K', 'M', 'B', 'T')
    val exp = (ln(abs(value).toDouble()) / ln(1000.0)).toInt().coerceAtMost(suffixes.size - 1)
    val base = value / 1000.0.pow(exp.toDouble())

    return if (base == base.toLong().toDouble()) {
        "${base.toLong()}${suffixes[exp]}"
    } else {
        String.format(Locale.US, "%.1f%c", base, suffixes[exp])
    }.trim()
}

/**
 * Extension property to format a Long as a compact number.
 */
val Long.compact: String get() = this.compactNumber()

/**
 * Extension property to format an Int as a compact number.
 */
val Int.compact: String get() = this.compactNumber()

/**
 * Capitalizes the first character of the string.
 */
fun String.capitalizeFirst(): String {
    if (isEmpty()) return this
    return this[0].uppercase() + substring(1)
}

/**
 * Converts a snake_case or kebab-case string to Title Case.
 */
fun String.toTitleCase(): String {
    return replace(Regex("[_-]"), " ")
        .split(" ")
        .joinToString(" ") { it.capitalizeFirst() }
}

/**
 * Returns the string's initials (first letter of each word, up to 2 characters).
 */
fun String.initials(maxLength: Int = 2): String {
    return trim()
        .split(Regex("\\s+"))
        .take(maxLength)
        .mapNotNull { it.firstOrNull()?.uppercase() }
        .joinToString("")
}

/**
 * Masks an email address for display.
 * Example: "john.doe@email.com" -> "j***e@email.com"
 */
fun String.maskEmail(): String {
    val parts = split("@")
    if (parts.size != 2) return this
    val local = parts[0]
    val domain = parts[1]
    if (local.length <= 2) return "${local.first()}***@$domain"
    return "${local.first()}***${local.last()}@$domain"
}

/**
 * Formats a percentage value.
 * Example: 0.156 -> "15.6%", 1.0 -> "100%"
 */
fun Double.formatPercentage(decimals: Int = 1): String {
    val percent = this * 100
    return if (percent == percent.toLong().toDouble()) {
        "${percent.toLong()}%"
    } else {
        String.format(Locale.US, "%.${decimals}f%%", percent)
    }
}

/**
 * Formats a currency value.
 * Example: 1234.56 -> "$1,234.56", 1000.0 -> "$1,000"
 */
fun Double.formatCurrency(symbol: String = "$"): String {
    return if (this == toLong().toDouble()) {
        "$symbol${String.format(Locale.US, "%,d", toLong())}"
    } else {
        "$symbol${String.format(Locale.US, "%,.2f", this)}"
    }
}
