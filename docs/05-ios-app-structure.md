# Algo - iOS App Structure

## Project Setup
- **Minimum iOS**: 17.0
- **Language**: Swift 5.9+
- **UI**: SwiftUI
- **Architecture**: MVVM + Clean Architecture
- **Package Manager**: Swift Package Manager

---

## Directory Structure

```
Algo-iOS/
├── Algo.xcodeproj
├── Algo/
│   ├── App/
│   │   ├── AlgoApp.swift                    # App entry point
│   │   ├── AppDelegate.swift                # Push notifications setup
│   │   └── AppConfiguration.swift           # Environment config
│   │
│   ├── Core/
│   │   ├── DI/
│   │   │   └── DependencyContainer.swift    # Dependency injection
│   │   ├── Network/
│   │   │   ├── APIClient.swift              # Base HTTP client (URLSession)
│   │   │   ├── APIEndpoint.swift            # Endpoint definitions
│   │   │   ├── APIError.swift               # Error types
│   │   │   ├── AuthInterceptor.swift        # JWT token injection
│   │   │   ├── WebSocketClient.swift        # Real-time connection
│   │   │   └── NetworkMonitor.swift         # Connectivity status
│   │   ├── Storage/
│   │   │   ├── KeychainManager.swift        # Secure token storage
│   │   │   ├── UserDefaultsManager.swift    # App preferences
│   │   │   └── ConversationCache.swift      # Local conversation cache
│   │   ├── Audio/
│   │   │   ├── SpeechRecognizer.swift       # Speech-to-Text
│   │   │   ├── TextToSpeechEngine.swift     # TTS playback
│   │   │   └── AudioRecorder.swift          # Voice recording
│   │   └── Extensions/
│   │       ├── Date+Extensions.swift
│   │       ├── String+Extensions.swift
│   │       └── View+Extensions.swift
│   │
│   ├── Features/
│   │   ├── Auth/
│   │   │   ├── Models/
│   │   │   │   ├── User.swift
│   │   │   │   ├── AuthToken.swift
│   │   │   │   └── LoginRequest.swift
│   │   │   ├── Services/
│   │   │   │   └── AuthService.swift
│   │   │   ├── ViewModels/
│   │   │   │   └── AuthViewModel.swift
│   │   │   └── Views/
│   │   │       ├── LoginView.swift
│   │   │       ├── BiometricPromptView.swift
│   │   │       └── SplashView.swift
│   │   │
│   │   ├── Chat/
│   │   │   ├── Models/
│   │   │   │   ├── Message.swift
│   │   │   │   ├── Conversation.swift
│   │   │   │   ├── ChatResponse.swift
│   │   │   │   ├── SuggestedAction.swift
│   │   │   │   └── StructuredData.swift
│   │   │   ├── Services/
│   │   │   │   ├── ChatService.swift
│   │   │   │   └── ConversationRepository.swift
│   │   │   ├── ViewModels/
│   │   │   │   ├── ChatViewModel.swift
│   │   │   │   └── ConversationListViewModel.swift
│   │   │   └── Views/
│   │   │       ├── ChatView.swift
│   │   │       ├── MessageBubble.swift
│   │   │       ├── VoiceInputButton.swift
│   │   │       ├── SuggestedActionsBar.swift
│   │   │       ├── ConfirmationCard.swift
│   │   │       ├── MetricsCard.swift
│   │   │       ├── ChartView.swift
│   │   │       └── ConversationListView.swift
│   │   │
│   │   ├── Dashboard/
│   │   │   ├── Models/
│   │   │   │   ├── DashboardMetrics.swift
│   │   │   │   └── Alert.swift
│   │   │   ├── Services/
│   │   │   │   └── DashboardService.swift
│   │   │   ├── ViewModels/
│   │   │   │   └── DashboardViewModel.swift
│   │   │   └── Views/
│   │   │       ├── DashboardView.swift
│   │   │       ├── MetricTile.swift
│   │   │       ├── AlertCard.swift
│   │   │       └── QuickActionsGrid.swift
│   │   │
│   │   ├── Notifications/
│   │   │   ├── Models/
│   │   │   │   └── AppNotification.swift
│   │   │   ├── Services/
│   │   │   │   ├── NotificationService.swift
│   │   │   │   └── PushNotificationHandler.swift
│   │   │   ├── ViewModels/
│   │   │   │   └── NotificationsViewModel.swift
│   │   │   └── Views/
│   │   │       ├── NotificationsView.swift
│   │   │       └── NotificationRow.swift
│   │   │
│   │   └── Settings/
│   │       ├── ViewModels/
│   │       │   └── SettingsViewModel.swift
│   │       └── Views/
│   │           ├── SettingsView.swift
│   │           └── NotificationPreferencesView.swift
│   │
│   ├── Navigation/
│   │   ├── AppRouter.swift                  # Navigation coordinator
│   │   ├── MainTabView.swift                # Tab bar
│   │   └── DeepLinkHandler.swift            # Push notification deep links
│   │
│   ├── Design/
│   │   ├── Theme/
│   │   │   ├── AlgoTheme.swift              # Colors, typography
│   │   │   ├── Colors.swift
│   │   │   └── Typography.swift
│   │   ├── Components/
│   │   │   ├── AlgoButton.swift
│   │   │   ├── AlgoTextField.swift
│   │   │   ├── LoadingView.swift
│   │   │   ├── ErrorView.swift
│   │   │   └── AnimatedWaveform.swift       # Voice recording animation
│   │   └── Assets.xcassets/
│   │
│   └── Resources/
│       ├── Info.plist
│       ├── Localizable.strings
│       └── Algo.entitlements
│
├── AlgoTests/
│   ├── ChatViewModelTests.swift
│   ├── AuthServiceTests.swift
│   ├── IntentParsingTests.swift
│   └── Mocks/
│       ├── MockAPIClient.swift
│       └── MockChatService.swift
│
├── AlgoUITests/
│   ├── ChatFlowTests.swift
│   └── LoginFlowTests.swift
│
└── Packages/
    └── Package.swift                        # SPM dependencies
```

---

## Key Swift Files

### AlgoApp.swift
```swift
import SwiftUI

@main
struct AlgoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var authVM = AuthViewModel()
    @StateObject private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            Group {
                if authVM.isAuthenticated {
                    MainTabView()
                        .environmentObject(router)
                } else {
                    LoginView()
                }
            }
            .environmentObject(authVM)
        }
    }
}
```

### ChatView.swift
```swift
import SwiftUI

struct ChatView: View {
    @StateObject private var viewModel = ChatViewModel()
    @State private var inputText = ""
    @State private var isRecording = false

    var body: some View {
        VStack(spacing: 0) {
            // Message list
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: viewModel.messages.count) { _ in
                    if let last = viewModel.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            // Suggested actions
            if let actions = viewModel.suggestedActions {
                SuggestedActionsBar(actions: actions) { action in
                    viewModel.executeSuggestedAction(action)
                }
            }

            // Input bar
            HStack(spacing: 12) {
                TextField("Ask Algo...", text: $inputText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { sendMessage() }

                VoiceInputButton(
                    isRecording: $isRecording,
                    onTranscription: { text in
                        inputText = text
                        sendMessage()
                    }
                )

                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                }
                .disabled(inputText.isEmpty)
            }
            .padding()
        }
        .navigationTitle("Algo")
    }

    private func sendMessage() {
        guard !inputText.isEmpty else { return }
        viewModel.sendMessage(inputText)
        inputText = ""
    }
}
```

### SpeechRecognizer.swift
```swift
import Speech
import AVFoundation

@MainActor
class SpeechRecognizer: ObservableObject {
    @Published var transcript = ""
    @Published var isRecording = false

    private var audioEngine = AVAudioEngine()
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    func startRecording() async throws {
        guard let speechRecognizer, speechRecognizer.isAvailable else {
            throw SpeechError.recognizerUnavailable
        }

        let authStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard authStatus == .authorized else { throw SpeechError.notAuthorized }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
        isRecording = true

        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            if let result {
                Task { @MainActor in
                    self?.transcript = result.bestTranscription.formattedString
                }
            }
            if error != nil || (result?.isFinal ?? false) {
                Task { @MainActor in
                    self?.stopRecording()
                }
            }
        }
    }

    func stopRecording() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionTask?.cancel()
        recognitionTask = nil
        isRecording = false
    }
}

enum SpeechError: Error {
    case recognizerUnavailable
    case notAuthorized
}
```

### KeychainManager.swift
```swift
import Security
import Foundation

final class KeychainManager {
    static let shared = KeychainManager()
    private init() {}

    func save(key: String, data: Data) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed(status)
        }
    }

    func load(key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }

    func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainError: Error {
    case saveFailed(OSStatus)
}
```

---

## SPM Dependencies

```swift
// Package.swift
let package = Package(
    name: "AlgoDependencies",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(url: "https://github.com/SwiftGen/SwiftGen", from: "6.6.0"),
    ],
    targets: [
        .target(name: "AlgoDependencies", dependencies: [])
    ]
)
```

**Note**: Minimize external dependencies. Use native frameworks:
- URLSession for networking (no Alamofire needed)
- Swift Concurrency (async/await) for all async work
- SwiftUI Charts for data visualization
- Apple Speech framework for STT
- AVFoundation for TTS
- Keychain Services for secure storage
- SwiftData for local persistence (iOS 17+)
