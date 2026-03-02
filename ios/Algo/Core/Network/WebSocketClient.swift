// WebSocketClient.swift
// Algo
//
// Real-time WebSocket client for streaming responses, typing indicators,
// alerts, and metric updates from the Algo backend.
//
// Features:
// - JWT token authentication via query string
// - Exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
// - Heartbeat ping every 25 seconds
// - Typed event parsing for all server-sent event types
// - SwiftUI-compatible via ObservableObject

import Foundation
import Combine
import os

// MARK: - WebSocket Event Types

/// Represents a typed event received from the WebSocket server.
enum WebSocketEvent: Equatable {
    /// The AI assistant is composing a response.
    case typing(conversationId: String)

    /// A chunk of a streaming response.
    case streamChunk(conversationId: String, chunk: String)

    /// The streaming response is complete.
    case streamEnd(conversationId: String, messageId: String)

    /// A real-time alert (hot lead, campaign drop, etc.).
    case alert(WebSocketAlertPayload)

    /// A dashboard metric has been updated.
    case metricUpdate(metric: String, value: Double)

    /// The WebSocket connection was established.
    case connected

    /// The WebSocket connection was lost.
    case disconnected(reason: String?)
}

/// Payload for a real-time alert delivered via WebSocket.
struct WebSocketAlertPayload: Equatable, Decodable {
    let id: String
    let type: String
    let severity: String?
    let title: String?
    let message: String?
}

// MARK: - Connection State

/// Represents the current state of the WebSocket connection.
enum WebSocketConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case reconnecting(attempt: Int)
}

// MARK: - Internal Message Model

/// The raw JSON structure received from the WebSocket server.
private struct WebSocketMessage: Decodable {
    let type: String
    let conversationId: String?
    let chunk: String?
    let messageId: String?
    let metric: String?
    let value: Double?
    let alert: WebSocketAlertPayload?

    enum CodingKeys: String, CodingKey {
        case type
        case conversationId = "conversation_id"
        case chunk
        case messageId = "message_id"
        case metric
        case value
        case alert
    }
}

// MARK: - WebSocketClient

/// A real-time WebSocket client for the Algo backend.
///
/// Manages the WebSocket connection lifecycle including authentication,
/// automatic reconnection with exponential backoff, heartbeat pings,
/// and typed event parsing.
///
/// Usage:
/// ```swift
/// let client = WebSocketClient(keychainManager: keychain)
/// client.connect()
///
/// // SwiftUI observation
/// Text(client.connectionState == .connected ? "Online" : "Offline")
///
/// // Event stream via Combine
/// client.events.sink { event in
///     switch event {
///     case .streamChunk(_, let chunk):
///         print(chunk)
///     default:
///         break
///     }
/// }
/// ```
@MainActor
final class WebSocketClient: NSObject, ObservableObject {

    // MARK: - Published Properties

    /// The current connection state, observable from SwiftUI views.
    @Published private(set) var connectionState: WebSocketConnectionState = .disconnected

    /// Whether the WebSocket is currently connected.
    @Published private(set) var isConnected: Bool = false

    // MARK: - Event Publisher

    /// Publisher that emits typed WebSocket events.
    private let eventSubject = PassthroughSubject<WebSocketEvent, Never>()

    /// A Combine publisher for observing WebSocket events.
    var events: AnyPublisher<WebSocketEvent, Never> {
        eventSubject.eraseToAnyPublisher()
    }

    // MARK: - Dependencies

    private let keychainManager: KeychainManager
    private let webSocketURL: URL

    // MARK: - Internal State

    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var pingTimer: Timer?
    private var reconnectTask: Task<Void, Never>?

    /// Current reconnection attempt count (resets on successful connection).
    private var reconnectAttempt: Int = 0

    /// Maximum delay cap for exponential backoff, in seconds.
    private let maxReconnectDelay: TimeInterval = 30

    /// Base delay for exponential backoff, in seconds.
    private let baseReconnectDelay: TimeInterval = 1.0

    /// Heartbeat ping interval, in seconds.
    private let pingInterval: TimeInterval = AppConfiguration.webSocketPingInterval

    /// Whether a deliberate disconnect was requested (suppresses auto-reconnect).
    private var isIntentionalDisconnect: Bool = false

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()

    private let logger = Logger(subsystem: "com.algonit.algo", category: "WebSocket")

    // MARK: - Initialization

    /// Creates a new WebSocket client.
    ///
    /// - Parameters:
    ///   - keychainManager: The keychain manager for retrieving the JWT token.
    ///   - webSocketURL: The WebSocket server URL. Defaults to `AppConfiguration.webSocketURL`.
    init(
        keychainManager: KeychainManager,
        webSocketURL: URL = AppConfiguration.webSocketURL
    ) {
        self.keychainManager = keychainManager
        self.webSocketURL = webSocketURL
        super.init()
    }

    deinit {
        pingTimer?.invalidate()
        reconnectTask?.cancel()
    }

    // MARK: - Connection Management

    /// Opens a WebSocket connection to the Algo backend.
    ///
    /// The JWT token is attached as a query parameter for authentication.
    /// If already connected, this method does nothing.
    func connect() {
        guard webSocketTask == nil else {
            logger.debug("WebSocket already active, skipping connect")
            return
        }

        isIntentionalDisconnect = false
        connectionState = .connecting

        // Build URL with token query parameter
        var components = URLComponents(url: webSocketURL, resolvingAgainstBaseURL: false)!
        if let token = keychainManager.getToken() {
            components.queryItems = [URLQueryItem(name: "token", value: token)]
        }

        guard let url = components.url else {
            logger.error("Failed to construct WebSocket URL")
            return
        }

        let configuration = URLSessionConfiguration.default
        configuration.waitsForConnectivity = true
        urlSession = URLSession(
            configuration: configuration,
            delegate: self,
            delegateQueue: nil
        )

        webSocketTask = urlSession?.webSocketTask(with: url)
        webSocketTask?.resume()

        // Start listening for messages
        listenForMessages()
        startPingTimer()
    }

    /// Gracefully closes the WebSocket connection.
    ///
    /// Sets the `isIntentionalDisconnect` flag to suppress automatic reconnection.
    func disconnect() {
        isIntentionalDisconnect = true
        reconnectTask?.cancel()
        reconnectTask = nil
        tearDownConnection(reason: "User requested disconnect")
    }

    // MARK: - Message Listening

    /// Recursively listens for incoming WebSocket messages.
    private func listenForMessages() {
        webSocketTask?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }

                switch result {
                case .success(let message):
                    self.handleRawMessage(message)
                    self.listenForMessages()

                case .failure(let error):
                    self.logger.error("WebSocket receive error: \(error.localizedDescription)")
                    self.handleDisconnection(reason: error.localizedDescription)
                }
            }
        }
    }

    /// Parses a raw WebSocket message into a typed event.
    private func handleRawMessage(_ message: URLSessionWebSocketTask.Message) {
        let data: Data

        switch message {
        case .string(let text):
            guard let textData = text.data(using: .utf8) else { return }
            data = textData
        case .data(let rawData):
            data = rawData
        @unknown default:
            return
        }

        guard let wsMessage = try? decoder.decode(WebSocketMessage.self, from: data) else {
            logger.warning("Failed to decode WebSocket message")
            return
        }

        let event: WebSocketEvent

        switch wsMessage.type {
        case "typing":
            guard let conversationId = wsMessage.conversationId else { return }
            event = .typing(conversationId: conversationId)

        case "stream":
            guard let conversationId = wsMessage.conversationId,
                  let chunk = wsMessage.chunk else { return }
            event = .streamChunk(conversationId: conversationId, chunk: chunk)

        case "stream_end":
            guard let conversationId = wsMessage.conversationId,
                  let messageId = wsMessage.messageId else { return }
            event = .streamEnd(conversationId: conversationId, messageId: messageId)

        case "alert":
            guard let alert = wsMessage.alert else { return }
            event = .alert(alert)

        case "metric_update":
            guard let metric = wsMessage.metric,
                  let value = wsMessage.value else { return }
            event = .metricUpdate(metric: metric, value: value)

        default:
            logger.debug("Unknown WebSocket message type: \(wsMessage.type)")
            return
        }

        eventSubject.send(event)
    }

    // MARK: - Heartbeat

    /// Starts a repeating timer that sends WebSocket pings.
    private func startPingTimer() {
        stopPingTimer()
        pingTimer = Timer.scheduledTimer(
            withTimeInterval: pingInterval,
            repeats: true
        ) { [weak self] _ in
            Task { @MainActor in
                self?.sendPing()
            }
        }
    }

    /// Sends a single ping to the server to keep the connection alive.
    private func sendPing() {
        webSocketTask?.sendPing { [weak self] error in
            Task { @MainActor in
                if let error {
                    self?.logger.warning("Ping failed: \(error.localizedDescription)")
                    self?.handleDisconnection(reason: "Ping timeout")
                }
            }
        }
    }

    /// Stops the heartbeat timer.
    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }

    // MARK: - Reconnection

    /// Handles an unexpected disconnection by attempting to reconnect.
    private func handleDisconnection(reason: String?) {
        tearDownConnection(reason: reason)

        guard !isIntentionalDisconnect else { return }
        attemptReconnect()
    }

    /// Tears down the current connection and updates state.
    private func tearDownConnection(reason: String?) {
        stopPingTimer()
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil

        connectionState = .disconnected
        isConnected = false
        eventSubject.send(.disconnected(reason: reason))
    }

    /// Schedules a reconnection attempt with exponential backoff.
    ///
    /// Backoff sequence: 1s, 2s, 4s, 8s, 16s, capped at 30s.
    private func attemptReconnect() {
        reconnectTask?.cancel()

        reconnectAttempt += 1
        let delay = min(
            baseReconnectDelay * pow(2.0, Double(reconnectAttempt - 1)),
            maxReconnectDelay
        )

        connectionState = .reconnecting(attempt: reconnectAttempt)
        logger.info("Scheduling reconnect attempt \(self.reconnectAttempt) in \(delay)s")

        reconnectTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))

            guard !Task.isCancelled else { return }
            await MainActor.run {
                self?.connect()
            }
        }
    }

    // MARK: - Send

    /// Sends a text message through the WebSocket connection.
    ///
    /// - Parameter text: The JSON string to send.
    /// - Throws: An error if the message could not be sent.
    func send(_ text: String) async throws {
        guard let webSocketTask, connectionState == .connected else {
            throw APIError.networkError("WebSocket is not connected")
        }
        try await webSocketTask.send(.string(text))
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WebSocketClient: URLSessionWebSocketDelegate {

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            self.reconnectAttempt = 0
            self.connectionState = .connected
            self.isConnected = true
            self.eventSubject.send(.connected)
            self.logger.info("WebSocket connected")
        }
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let reasonString = reason.flatMap { String(data: $0, encoding: .utf8) }
        Task { @MainActor in
            self.logger.info("WebSocket closed: \(closeCode.rawValue) - \(reasonString ?? "no reason")")
            self.handleDisconnection(reason: reasonString)
        }
    }
}
