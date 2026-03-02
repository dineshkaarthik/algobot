package com.algonit.algo.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.algonit.algo.core.storage.PreferencesManager
import com.algonit.algo.features.dashboard.presentation.DashboardScreen
import com.algonit.algo.features.growth.presentation.GrowthScreen
import com.algonit.algo.features.growth.presentation.components.ExecutionHistoryScreen
import com.algonit.algo.features.notifications.presentation.NotificationsScreen
import com.algonit.algo.features.notifications.presentation.NotificationsViewModel
import com.algonit.algo.features.onboarding.presentation.OnboardingScreen
import com.algonit.algo.features.settings.presentation.NotificationPreferencesScreen
import kotlinx.coroutines.launch
import com.algonit.algo.features.auth.presentation.LoginScreen
import com.algonit.algo.features.settings.presentation.SettingsScreen

private const val DEEP_LINK_BASE = "algo://algonit.com"
private const val TRANSITION_DURATION = 300

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val badgeCount: Int = 0
)

@Composable
fun AlgoNavGraph(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Dashboard.route,
    deepLinkDestination: DeepLinkHandler.DeepLinkDestination? = null,
    preferencesManager: PreferencesManager? = null,
    hasCompletedOnboarding: Boolean = true
) {
    val notificationsViewModel: NotificationsViewModel = hiltViewModel()
    val unreadCount by notificationsViewModel.unreadCount.collectAsStateWithLifecycle()
    val coroutineScope = rememberCoroutineScope()

    // Determine the effective start destination based on onboarding status
    val effectiveStartDestination = if (!hasCompletedOnboarding) {
        Screen.Onboarding.route
    } else {
        startDestination
    }

    val bottomNavItems = listOf(
        BottomNavItem(
            screen = Screen.Dashboard,
            label = "Dashboard",
            selectedIcon = Icons.Filled.Dashboard,
            unselectedIcon = Icons.Outlined.Dashboard
        ),
        BottomNavItem(
            screen = Screen.Growth,
            label = "Growth",
            selectedIcon = Icons.Filled.TrendingUp,
            unselectedIcon = Icons.Outlined.TrendingUp
        ),
        BottomNavItem(
            screen = Screen.Chat,
            label = "Chat",
            selectedIcon = Icons.Filled.ChatBubble,
            unselectedIcon = Icons.Outlined.ChatBubbleOutline
        ),
        BottomNavItem(
            screen = Screen.Notifications,
            label = "Alerts",
            selectedIcon = Icons.Filled.Notifications,
            unselectedIcon = Icons.Outlined.Notifications,
            badgeCount = unreadCount
        ),
        BottomNavItem(
            screen = Screen.Settings,
            label = "Settings",
            selectedIcon = Icons.Filled.Settings,
            unselectedIcon = Icons.Outlined.Settings
        )
    )

    // Routes that show the bottom navigation bar
    val bottomNavRoutes = setOf(
        Screen.Dashboard.route,
        Screen.Growth.route,
        Screen.Chat.route,
        Screen.Notifications.route,
        Screen.Settings.route
    )

    Scaffold(
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination

            if (currentDestination?.route in bottomNavRoutes) {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 2.dp
                ) {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any {
                            it.route == item.screen.route
                        } == true

                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                BadgedBox(
                                    badge = {
                                        if (item.badgeCount > 0) {
                                            Badge {
                                                Text(
                                                    text = if (item.badgeCount > 99) "99+"
                                                    else item.badgeCount.toString()
                                                )
                                            }
                                        }
                                    }
                                ) {
                                    Icon(
                                        imageVector = if (selected) item.selectedIcon
                                        else item.unselectedIcon,
                                        contentDescription = item.label
                                    )
                                }
                            },
                            label = { Text(text = item.label) }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = effectiveStartDestination,
            modifier = modifier.padding(innerPadding),
            enterTransition = {
                fadeIn(animationSpec = tween(TRANSITION_DURATION)) +
                    slideIntoContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Start,
                        animationSpec = tween(TRANSITION_DURATION)
                    )
            },
            exitTransition = {
                fadeOut(animationSpec = tween(TRANSITION_DURATION)) +
                    slideOutOfContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.Start,
                        animationSpec = tween(TRANSITION_DURATION)
                    )
            },
            popEnterTransition = {
                fadeIn(animationSpec = tween(TRANSITION_DURATION)) +
                    slideIntoContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.End,
                        animationSpec = tween(TRANSITION_DURATION)
                    )
            },
            popExitTransition = {
                fadeOut(animationSpec = tween(TRANSITION_DURATION)) +
                    slideOutOfContainer(
                        towards = AnimatedContentTransitionScope.SlideDirection.End,
                        animationSpec = tween(TRANSITION_DURATION)
                    )
            }
        ) {
            composable(route = Screen.Onboarding.route) {
                OnboardingScreen(
                    onComplete = {
                        // Save onboarding completed flag
                        preferencesManager?.let { prefs ->
                            coroutineScope.launch {
                                prefs.setOnboardingCompleted(true)
                            }
                        }
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(
                route = Screen.Dashboard.route,
                deepLinks = listOf(
                    navDeepLink { uriPattern = "$DEEP_LINK_BASE/dashboard" }
                )
            ) {
                DashboardScreen(
                    onNavigateToChat = {
                        navController.navigate(Screen.Chat.route)
                    },
                    onNavigateToNotifications = {
                        navController.navigate(Screen.Notifications.route)
                    }
                )
            }

            composable(
                route = Screen.Growth.route,
                deepLinks = listOf(
                    navDeepLink { uriPattern = "$DEEP_LINK_BASE/growth" }
                )
            ) {
                GrowthScreen(
                    onNavigateToHistory = {
                        navController.navigate(Screen.ExecutionHistory.route)
                    }
                )
            }

            composable(route = Screen.ExecutionHistory.route) {
                ExecutionHistoryScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(route = Screen.Chat.route) {
                // Chat list screen - placeholder for existing chat feature
                // ChatListScreen would be imported from features/chat
            }

            composable(
                route = Screen.ChatDetail.route,
                arguments = listOf(
                    navArgument("conversationId") { type = NavType.StringType }
                ),
                deepLinks = listOf(
                    navDeepLink { uriPattern = "$DEEP_LINK_BASE/chat/{conversationId}" }
                )
            ) { backStackEntry ->
                val conversationId = backStackEntry.arguments?.getString("conversationId") ?: return@composable
                // ChatScreen(conversationId = conversationId) - from existing chat feature
            }

            composable(
                route = Screen.Notifications.route,
                deepLinks = listOf(
                    navDeepLink { uriPattern = "$DEEP_LINK_BASE/notifications" }
                )
            ) {
                NotificationsScreen(
                    viewModel = notificationsViewModel,
                    onNotificationClick = { notification ->
                        notification.actionUrl?.let { url ->
                            // Parse action URL and navigate accordingly
                            val segments = url.trimStart('/').split("/")
                            when {
                                segments.size >= 2 && segments[0] == "leads" -> {
                                    // Navigate to chat with lead context
                                    navController.navigate(Screen.Chat.route)
                                }
                                segments.size >= 2 && segments[0] == "campaigns" -> {
                                    navController.navigate(Screen.Chat.route)
                                }
                                else -> {
                                    navController.navigate(Screen.Chat.route)
                                }
                            }
                        }
                    }
                )
            }

            composable(route = Screen.Settings.route) {
                SettingsScreen(
                    onNavigateToNotificationPreferences = {
                        navController.navigate(Screen.NotificationPreferences.route)
                    },
                    onLogout = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            composable(route = Screen.NotificationPreferences.route) {
                NotificationPreferencesScreen(
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(route = Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }
        }
    }

    // Handle initial deep link navigation
    deepLinkDestination?.let { destination ->
        val route = DeepLinkHandler.destinationToRoute(destination)
        androidx.compose.runtime.LaunchedEffect(destination) {
            navController.navigate(route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
            }
        }
    }
}
