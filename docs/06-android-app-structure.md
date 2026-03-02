# Algo - Android App Structure

## Project Setup
- **Minimum SDK**: 26 (Android 8.0)
- **Target SDK**: 35
- **Language**: Kotlin 2.0+
- **UI**: Jetpack Compose
- **Architecture**: MVVM + Clean Architecture
- **Build**: Gradle (Kotlin DSL)
- **DI**: Hilt (Dagger)

---

## Directory Structure

```
Algo-Android/
├── app/
│   ├── build.gradle.kts
│   ├── src/
│   │   ├── main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/com/algonit/algo/
│   │   │   │   │
│   │   │   │   ├── AlgoApplication.kt            # Application class (Hilt)
│   │   │   │   │
│   │   │   │   ├── core/
│   │   │   │   │   ├── di/
│   │   │   │   │   │   ├── AppModule.kt           # App-level DI
│   │   │   │   │   │   ├── NetworkModule.kt       # Network DI
│   │   │   │   │   │   └── DatabaseModule.kt      # Database DI
│   │   │   │   │   ├── network/
│   │   │   │   │   │   ├── ApiClient.kt           # Ktor/Retrofit client
│   │   │   │   │   │   ├── ApiEndpoints.kt        # Endpoint definitions
│   │   │   │   │   │   ├── ApiError.kt            # Error types
│   │   │   │   │   │   ├── AuthInterceptor.kt     # JWT injection
│   │   │   │   │   │   ├── WebSocketClient.kt     # Real-time connection
│   │   │   │   │   │   └── NetworkMonitor.kt      # Connectivity
│   │   │   │   │   ├── storage/
│   │   │   │   │   │   ├── SecureStorage.kt       # EncryptedSharedPreferences
│   │   │   │   │   │   ├── PreferencesManager.kt  # App preferences
│   │   │   │   │   │   └── ConversationCache.kt   # Local cache
│   │   │   │   │   ├── audio/
│   │   │   │   │   │   ├── SpeechRecognizerManager.kt  # STT
│   │   │   │   │   │   ├── TextToSpeechManager.kt      # TTS
│   │   │   │   │   │   └── AudioRecorder.kt             # Recording
│   │   │   │   │   └── util/
│   │   │   │   │       ├── DateExtensions.kt
│   │   │   │   │       ├── StringExtensions.kt
│   │   │   │   │       └── Result.kt
│   │   │   │   │
│   │   │   │   ├── features/
│   │   │   │   │   ├── auth/
│   │   │   │   │   │   ├── data/
│   │   │   │   │   │   │   ├── model/
│   │   │   │   │   │   │   │   ├── User.kt
│   │   │   │   │   │   │   │   ├── AuthToken.kt
│   │   │   │   │   │   │   │   └── LoginRequest.kt
│   │   │   │   │   │   │   └── repository/
│   │   │   │   │   │   │       └── AuthRepositoryImpl.kt
│   │   │   │   │   │   ├── domain/
│   │   │   │   │   │   │   └── repository/
│   │   │   │   │   │   │       └── AuthRepository.kt
│   │   │   │   │   │   └── presentation/
│   │   │   │   │   │       ├── AuthViewModel.kt
│   │   │   │   │   │       ├── LoginScreen.kt
│   │   │   │   │   │       └── SplashScreen.kt
│   │   │   │   │   │
│   │   │   │   │   ├── chat/
│   │   │   │   │   │   ├── data/
│   │   │   │   │   │   │   ├── model/
│   │   │   │   │   │   │   │   ├── Message.kt
│   │   │   │   │   │   │   │   ├── Conversation.kt
│   │   │   │   │   │   │   │   ├── ChatResponse.kt
│   │   │   │   │   │   │   │   ├── SuggestedAction.kt
│   │   │   │   │   │   │   │   └── StructuredData.kt
│   │   │   │   │   │   │   ├── local/
│   │   │   │   │   │   │   │   ├── MessageDao.kt
│   │   │   │   │   │   │   │   └── ConversationDao.kt
│   │   │   │   │   │   │   └── repository/
│   │   │   │   │   │   │       └── ChatRepositoryImpl.kt
│   │   │   │   │   │   ├── domain/
│   │   │   │   │   │   │   ├── repository/
│   │   │   │   │   │   │   │   └── ChatRepository.kt
│   │   │   │   │   │   │   └── usecase/
│   │   │   │   │   │   │       ├── SendMessageUseCase.kt
│   │   │   │   │   │   │       └── GetConversationsUseCase.kt
│   │   │   │   │   │   └── presentation/
│   │   │   │   │   │       ├── ChatViewModel.kt
│   │   │   │   │   │       ├── ConversationListViewModel.kt
│   │   │   │   │   │       ├── ChatScreen.kt
│   │   │   │   │   │       ├── ConversationListScreen.kt
│   │   │   │   │   │       └── components/
│   │   │   │   │   │           ├── MessageBubble.kt
│   │   │   │   │   │           ├── VoiceInputButton.kt
│   │   │   │   │   │           ├── SuggestedActionsBar.kt
│   │   │   │   │   │           ├── ConfirmationCard.kt
│   │   │   │   │   │           ├── MetricsCard.kt
│   │   │   │   │   │           └── ChartView.kt
│   │   │   │   │   │
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   ├── data/
│   │   │   │   │   │   │   ├── model/
│   │   │   │   │   │   │   │   ├── DashboardMetrics.kt
│   │   │   │   │   │   │   │   └── Alert.kt
│   │   │   │   │   │   │   └── repository/
│   │   │   │   │   │   │       └── DashboardRepositoryImpl.kt
│   │   │   │   │   │   ├── domain/
│   │   │   │   │   │   │   └── repository/
│   │   │   │   │   │   │       └── DashboardRepository.kt
│   │   │   │   │   │   └── presentation/
│   │   │   │   │   │       ├── DashboardViewModel.kt
│   │   │   │   │   │       ├── DashboardScreen.kt
│   │   │   │   │   │       └── components/
│   │   │   │   │   │           ├── MetricTile.kt
│   │   │   │   │   │           ├── AlertCard.kt
│   │   │   │   │   │           └── QuickActionsGrid.kt
│   │   │   │   │   │
│   │   │   │   │   ├── notifications/
│   │   │   │   │   │   ├── data/
│   │   │   │   │   │   │   └── model/
│   │   │   │   │   │   │       └── AppNotification.kt
│   │   │   │   │   │   ├── service/
│   │   │   │   │   │   │   ├── AlgoFirebaseService.kt
│   │   │   │   │   │   │   └── NotificationChannelManager.kt
│   │   │   │   │   │   └── presentation/
│   │   │   │   │   │       ├── NotificationsViewModel.kt
│   │   │   │   │   │       └── NotificationsScreen.kt
│   │   │   │   │   │
│   │   │   │   │   └── settings/
│   │   │   │   │       └── presentation/
│   │   │   │   │           ├── SettingsViewModel.kt
│   │   │   │   │           ├── SettingsScreen.kt
│   │   │   │   │           └── NotificationPreferencesScreen.kt
│   │   │   │   │
│   │   │   │   ├── navigation/
│   │   │   │   │   ├── AlgoNavGraph.kt            # Navigation graph
│   │   │   │   │   ├── Screen.kt                  # Route definitions
│   │   │   │   │   └── DeepLinkHandler.kt         # Notification deep links
│   │   │   │   │
│   │   │   │   └── ui/
│   │   │   │       ├── theme/
│   │   │   │       │   ├── AlgoTheme.kt           # Material3 theme
│   │   │   │       │   ├── Color.kt
│   │   │   │       │   ├── Typography.kt
│   │   │   │       │   └── Shape.kt
│   │   │   │       └── components/
│   │   │   │           ├── AlgoButton.kt
│   │   │   │           ├── AlgoTextField.kt
│   │   │   │           ├── LoadingView.kt
│   │   │   │           ├── ErrorView.kt
│   │   │   │           └── AnimatedWaveform.kt
│   │   │   │
│   │   │   └── res/
│   │   │       ├── values/
│   │   │       │   ├── strings.xml
│   │   │       │   ├── colors.xml
│   │   │       │   └── themes.xml
│   │   │       ├── drawable/
│   │   │       └── mipmap/
│   │   │
│   │   └── test/
│   │       └── java/com/algonit/algo/
│   │           ├── ChatViewModelTest.kt
│   │           ├── AuthRepositoryTest.kt
│   │           └── IntentParsingTest.kt
│
├── build.gradle.kts                    # Root build file
├── settings.gradle.kts
└── gradle.properties
```

---

## Key Kotlin Files

### AlgoApplication.kt
```kotlin
@HiltAndroidApp
class AlgoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationChannelManager.createChannels(this)
    }
}
```

### MainActivity.kt
```kotlin
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AlgoTheme {
                val authViewModel: AuthViewModel = hiltViewModel()
                val isAuthenticated by authViewModel.isAuthenticated.collectAsStateWithLifecycle()

                if (isAuthenticated) {
                    AlgoNavGraph()
                } else {
                    LoginScreen()
                }
            }
        }
    }
}
```

### ChatScreen.kt
```kotlin
@Composable
fun ChatScreen(
    viewModel: ChatViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsStateWithLifecycle()
    val suggestedActions by viewModel.suggestedActions.collectAsStateWithLifecycle()
    var inputText by remember { mutableStateOf("") }
    var isRecording by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    Scaffold(
        topBar = { AlgoTopBar(title = "Algo") }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Messages
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(messages, key = { it.id }) { message ->
                    MessageBubble(message = message)
                }
            }

            // Suggested actions
            suggestedActions?.let { actions ->
                SuggestedActionsBar(
                    actions = actions,
                    onActionClick = viewModel::executeSuggestedAction
                )
            }

            // Input bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Ask Algo...") },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = {
                            viewModel.sendMessage(inputText)
                            inputText = ""
                        }
                    )
                )

                VoiceInputButton(
                    isRecording = isRecording,
                    onRecordingChange = { isRecording = it },
                    onTranscription = { text ->
                        viewModel.sendMessage(text)
                    }
                )

                IconButton(
                    onClick = {
                        viewModel.sendMessage(inputText)
                        inputText = ""
                    },
                    enabled = inputText.isNotBlank()
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Send")
                }
            }
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }
}
```

### SpeechRecognizerManager.kt
```kotlin
class SpeechRecognizerManager(
    private val context: Context
) {
    private var speechRecognizer: SpeechRecognizer? = null
    private val _transcript = MutableStateFlow("")
    val transcript: StateFlow<String> = _transcript.asStateFlow()

    private val _isListening = MutableStateFlow(false)
    val isListening: StateFlow<Boolean> = _isListening.asStateFlow()

    fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) return

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle?) {
                    val matches = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    _transcript.value = matches?.firstOrNull() ?: ""
                    _isListening.value = false
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    _transcript.value = matches?.firstOrNull() ?: ""
                }

                override fun onError(error: Int) { _isListening.value = false }
                override fun onReadyForSpeech(params: Bundle?) { _isListening.value = true }
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        speechRecognizer?.startListening(intent)
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        _isListening.value = false
    }

    fun destroy() {
        speechRecognizer?.destroy()
        speechRecognizer = null
    }
}
```

### SecureStorage.kt
```kotlin
@Singleton
class SecureStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val prefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            "algo_secure_prefs",
            MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC),
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    fun saveToken(token: String) = prefs.edit().putString("access_token", token).apply()
    fun getToken(): String? = prefs.getString("access_token", null)
    fun saveRefreshToken(token: String) = prefs.edit().putString("refresh_token", token).apply()
    fun getRefreshToken(): String? = prefs.getString("refresh_token", null)
    fun clearAll() = prefs.edit().clear().apply()
}
```

---

## Gradle Dependencies

```kotlin
// app/build.gradle.kts
dependencies {
    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2025.02.00")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")

    // Navigation
    implementation("androidx.navigation:navigation-compose:2.8.0")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.0")

    // Hilt
    implementation("com.google.dagger:hilt-android:2.51")
    kapt("com.google.dagger:hilt-compiler:2.51")
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")

    // Networking
    implementation("io.ktor:ktor-client-android:2.3.8")
    implementation("io.ktor:ktor-client-content-negotiation:2.3.8")
    implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.8")
    implementation("io.ktor:ktor-client-websockets:2.3.8")

    // Room (local DB)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")

    // Security
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:33.0.0"))
    implementation("com.google.firebase:firebase-messaging")

    // Charts
    implementation("com.patrykandpatrick.vico:compose-m3:2.0.0-beta.1")

    // Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.0")
    testImplementation("io.mockk:mockk:1.13.9")
}
```
