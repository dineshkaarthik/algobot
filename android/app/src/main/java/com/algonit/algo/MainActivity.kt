package com.algonit.algo

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.algonit.algo.core.storage.PreferencesManager
import com.algonit.algo.navigation.AlgoNavGraph
import com.algonit.algo.navigation.DeepLinkHandler
import com.algonit.algo.navigation.Screen
import com.algonit.algo.ui.theme.AlgoTheme
import com.algonit.algo.ui.theme.DarkModeManager
import com.algonit.algo.ui.theme.ThemeMode
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var preferencesManager: PreferencesManager
    @Inject lateinit var darkModeManager: DarkModeManager

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        // Parse deep link from intent (e.g., from notification tap)
        val deepLinkDestination = DeepLinkHandler.parse(intent)

        enableEdgeToEdge()

        // Keep splash screen visible while checking auth state
        var isReady = false
        splashScreen.setKeepOnScreenCondition { !isReady }

        setContent {
            val themeMode by darkModeManager.themeMode.collectAsStateWithLifecycle(
                initialValue = ThemeMode.SYSTEM
            )
            val hasCompletedOnboarding by preferencesManager.hasCompletedOnboarding
                .collectAsStateWithLifecycle(initialValue = true)

            AlgoTheme(themeMode = themeMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AlgoApp(
                        deepLinkDestination = deepLinkDestination,
                        onReady = { isReady = true },
                        preferencesManager = preferencesManager,
                        hasCompletedOnboarding = hasCompletedOnboarding
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Deep links from new intents (e.g., notification tapped while app is open)
        // will be handled by the NavController's deep link support
    }
}

@Composable
private fun AlgoApp(
    deepLinkDestination: DeepLinkHandler.DeepLinkDestination?,
    onReady: () -> Unit,
    preferencesManager: PreferencesManager,
    hasCompletedOnboarding: Boolean
) {
    // In a full implementation, AuthViewModel would be injected here to
    // check authentication state and decide the start destination.
    // For now, we go directly to the main navigation graph.
    var isAuthenticated by remember { mutableStateOf(true) } // Placeholder

    LaunchedEffect(Unit) {
        // Simulate auth check delay or verify token
        // val authViewModel: AuthViewModel = hiltViewModel() would be used in production
        onReady()
    }

    if (isAuthenticated) {
        AlgoNavGraph(
            startDestination = Screen.Dashboard.route,
            deepLinkDestination = deepLinkDestination,
            preferencesManager = preferencesManager,
            hasCompletedOnboarding = hasCompletedOnboarding
        )
    } else {
        // LoginScreen would go here from features/auth
        // LoginScreen(onLoginSuccess = { isAuthenticated = true })
    }
}
