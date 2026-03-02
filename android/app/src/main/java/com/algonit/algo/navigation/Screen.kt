package com.algonit.algo.navigation

sealed class Screen(val route: String) {
    data object Splash : Screen("splash")
    data object Onboarding : Screen("onboarding")
    data object Login : Screen("login")
    data object Chat : Screen("chat")
    data object ChatDetail : Screen("chat/{conversationId}") {
        fun createRoute(id: String) = "chat/$id"
    }
    data object Dashboard : Screen("dashboard")
    data object Notifications : Screen("notifications")
    data object Growth : Screen("growth")
    data object ExecutionHistory : Screen("growth/history")
    data object Settings : Screen("settings")
    data object NotificationPreferences : Screen("settings/notifications")
}
