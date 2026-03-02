// DependencyContainer.swift
// Algo
//
// Simple dependency injection container that owns and provides
// singleton instances of core services. No external DI framework.
//
// The container is created once at app launch and passed through
// the SwiftUI environment. All dependencies are lazily initialized
// and reused across the app.

import Foundation
import SwiftUI
import os

/// Central dependency injection container for the Algo app.
///
/// Holds singleton instances of all core services: networking, storage,
/// audio, and monitoring. Created once in `AlgoApp` and distributed
/// through the SwiftUI environment.
///
/// Usage:
/// ```swift
/// // At app launch
/// @StateObject private var container = DependencyContainer()
///
/// var body: some Scene {
///     WindowGroup {
///         ContentView()
///             .environmentObject(container)
///     }
/// }
///
/// // In any view
/// @EnvironmentObject var container: DependencyContainer
/// let conversations = try await container.apiClient.get(.conversations)
/// ```
@MainActor
final class DependencyContainer: ObservableObject {

    // MARK: - Storage

    /// Secure token and credential storage via iOS Keychain.
    let keychainManager: KeychainManager

    /// Non-sensitive app preferences via UserDefaults.
    let userDefaultsManager: UserDefaultsManager

    /// In-memory LRU cache for conversations and messages.
    let conversationCache: ConversationCache

    // MARK: - Network

    /// The primary HTTP client for REST API calls.
    let apiClient: APIClient

    /// Real-time WebSocket client for streaming and alerts.
    let webSocketClient: WebSocketClient

    /// Network connectivity monitor.
    let networkMonitor: NetworkMonitor

    // MARK: - Audio

    /// On-device speech-to-text recognizer.
    let speechRecognizer: SpeechRecognizer

    /// Text-to-speech playback engine.
    let textToSpeechEngine: TextToSpeechEngine

    /// Audio recorder for voice input capture.
    let audioRecorder: AudioRecorder

    // MARK: - Logger

    private let logger = Logger(subsystem: "com.algonit.algo", category: "DI")

    // MARK: - Initialization

    /// Creates the dependency container with all services initialized.
    ///
    /// Dependencies are wired together in the correct order:
    /// 1. Storage services (no dependencies)
    /// 2. Network services (depend on KeychainManager)
    /// 3. Audio services (no dependencies)
    /// 4. Cross-cutting concerns (auth failure callback)
    ///
    /// - Parameters:
    ///   - keychainManager: Override for testing. Defaults to a new instance.
    ///   - userDefaultsManager: Override for testing. Defaults to a new instance.
    init(
        keychainManager: KeychainManager = KeychainManager(),
        userDefaultsManager: UserDefaultsManager = UserDefaultsManager()
    ) {
        // 1. Storage
        self.keychainManager = keychainManager
        self.userDefaultsManager = userDefaultsManager
        self.conversationCache = ConversationCache()

        // 2. Network
        self.apiClient = APIClient(keychainManager: keychainManager)
        self.webSocketClient = WebSocketClient(keychainManager: keychainManager)
        self.networkMonitor = NetworkMonitor()

        // 3. Audio
        self.speechRecognizer = SpeechRecognizer()
        self.textToSpeechEngine = TextToSpeechEngine()
        self.audioRecorder = AudioRecorder()

        // 4. Wire up cross-cutting callbacks
        setupAuthFailureHandler()

        logger.info("DependencyContainer initialized (\(AppConfiguration.current.rawValue) environment)")
    }

    // MARK: - Auth Failure Handling

    /// Configures the API client to broadcast authentication failures.
    ///
    /// When the API client detects an irrecoverable 401 (refresh token expired),
    /// the WebSocket is disconnected and the conversation cache is cleared
    /// to prepare for re-authentication.
    private func setupAuthFailureHandler() {
        apiClient.onAuthenticationFailure = { [weak self] in
            Task { @MainActor in
                guard let self else { return }
                self.logger.warning("Authentication failure detected, cleaning up session")
                self.webSocketClient.disconnect()
                await self.conversationCache.clearAll()
                // The AuthViewModel (observing keychainManager.hasToken) will
                // automatically navigate to the login screen.
            }
        }
    }

    // MARK: - Session Lifecycle

    /// Called after successful login to initialize real-time services.
    ///
    /// Connects the WebSocket and starts monitoring for alerts.
    func onSessionStart() {
        logger.info("Session started, connecting WebSocket")
        webSocketClient.connect()
    }

    /// Called during logout to tear down all session-specific state.
    ///
    /// Disconnects WebSocket, clears tokens, preferences, and caches.
    func onSessionEnd() {
        logger.info("Session ending, cleaning up")
        webSocketClient.disconnect()
        keychainManager.clearAll()
        userDefaultsManager.resetAll()

        Task {
            await conversationCache.clearAll()
        }
    }
}

// MARK: - SwiftUI Environment Key

/// Environment key for accessing the `DependencyContainer` without `@EnvironmentObject`.
///
/// Usage:
/// ```swift
/// @Environment(\.dependencyContainer) var container
/// ```
private struct DependencyContainerKey: EnvironmentKey {
    @MainActor static let defaultValue: DependencyContainer = DependencyContainer()
}

extension EnvironmentValues {
    /// The app's dependency container.
    var dependencyContainer: DependencyContainer {
        get { self[DependencyContainerKey.self] }
        set { self[DependencyContainerKey.self] = newValue }
    }
}
