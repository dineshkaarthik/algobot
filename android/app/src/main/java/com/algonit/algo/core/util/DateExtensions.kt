package com.algonit.algo.core.util

import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.Locale

/**
 * Converts an ISO 8601 date string to a relative time string.
 * Examples: "Just now", "2m ago", "1h ago", "Yesterday", "Mar 15"
 */
fun String.toRelativeString(): String {
    val instant = try {
        Instant.parse(this)
    } catch (e: Exception) {
        return this
    }
    return instant.toEpochMilli().toRelativeString()
}

/**
 * Converts epoch milliseconds to a relative time string.
 */
fun Long.toRelativeString(): String {
    val now = System.currentTimeMillis()
    val diffMs = now - this

    if (diffMs < 0) return "Just now"

    val seconds = diffMs / 1000
    val minutes = seconds / 60
    val hours = minutes / 60
    val days = hours / 24

    return when {
        seconds < 60 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        hours < 24 -> "${hours}h ago"
        days == 1L -> "Yesterday"
        days < 7 -> "${days}d ago"
        else -> {
            val date = Date(this)
            val currentYear = LocalDate.now().year
            val messageYear = date.toInstant()
                .atZone(ZoneId.systemDefault())
                .toLocalDate().year

            if (messageYear == currentYear) {
                SimpleDateFormat("MMM d", Locale.getDefault()).format(date)
            } else {
                SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(date)
            }
        }
    }
}

/**
 * Converts an ISO 8601 date string to a time string (e.g., "2:30 PM").
 */
fun String.toTimeString(): String {
    val instant = try {
        Instant.parse(this)
    } catch (e: Exception) {
        return this
    }
    return instant.toEpochMilli().toTimeString()
}

/**
 * Converts epoch milliseconds to a time string (e.g., "2:30 PM").
 */
fun Long.toTimeString(): String {
    val date = Date(this)
    return SimpleDateFormat("h:mm a", Locale.getDefault()).format(date)
}

/**
 * Converts an ISO 8601 date string to a date string (e.g., "March 15, 2026").
 */
fun String.toDateString(): String {
    val instant = try {
        Instant.parse(this)
    } catch (e: Exception) {
        return this
    }
    return instant.toEpochMilli().toDateString()
}

/**
 * Converts epoch milliseconds to a date string (e.g., "March 15, 2026").
 */
fun Long.toDateString(): String {
    val date = Date(this)
    return SimpleDateFormat("MMMM d, yyyy", Locale.getDefault()).format(date)
}

/**
 * Parses an ISO 8601 date string to epoch milliseconds.
 * Returns null if parsing fails.
 */
fun String.parseIso8601ToMillis(): Long? {
    return try {
        Instant.parse(this).toEpochMilli()
    } catch (e: Exception) {
        null
    }
}

/**
 * Converts epoch milliseconds to an ISO 8601 date string.
 */
fun Long.toIso8601(): String {
    return Instant.ofEpochMilli(this).toString()
}

/**
 * Returns a formatted date header for chat grouping.
 * Examples: "Today", "Yesterday", "Monday", "March 15"
 */
fun Long.toChatDateHeader(): String {
    val messageDate = Instant.ofEpochMilli(this)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
    val today = LocalDate.now()

    return when {
        messageDate == today -> "Today"
        messageDate == today.minusDays(1) -> "Yesterday"
        ChronoUnit.DAYS.between(messageDate, today) < 7 -> {
            messageDate.format(DateTimeFormatter.ofPattern("EEEE"))
        }
        messageDate.year == today.year -> {
            messageDate.format(DateTimeFormatter.ofPattern("MMMM d"))
        }
        else -> {
            messageDate.format(DateTimeFormatter.ofPattern("MMMM d, yyyy"))
        }
    }
}

/**
 * Formats a duration in seconds to a human-readable string.
 * Examples: "0:05", "1:30", "10:00"
 */
fun Int.formatDuration(): String {
    val minutes = this / 60
    val seconds = this % 60
    return "$minutes:${seconds.toString().padStart(2, '0')}"
}

/**
 * Formats a duration in seconds to a descriptive string.
 * Examples: "5 seconds", "2 minutes", "1 hour"
 */
fun Long.formatDurationDescriptive(): String {
    return when {
        this < 60 -> "$this second${if (this != 1L) "s" else ""}"
        this < 3600 -> {
            val minutes = this / 60
            "$minutes minute${if (minutes != 1L) "s" else ""}"
        }
        else -> {
            val hours = this / 3600
            "$hours hour${if (hours != 1L) "s" else ""}"
        }
    }
}
