// SpeechRecognizer.swift
// Algo
//
// On-device speech-to-text using Apple's Speech framework.
// Captures audio from the microphone, streams it through the
// speech recognition engine, and publishes partial/final transcripts.

import Foundation
import Speech
import AVFoundation
import os

/// Provides real-time speech-to-text transcription using Apple's Speech framework.
///
/// Manages microphone permissions, audio session configuration, and the
/// recognition lifecycle. Publishes partial transcripts as the user speaks
/// and a final transcript when recognition completes.
///
/// Usage:
/// ```swift
/// @StateObject var recognizer = SpeechRecognizer()
///
/// Button(recognizer.isRecording ? "Stop" : "Start") {
///     if recognizer.isRecording {
///         recognizer.stopRecording()
///     } else {
///         Task { try await recognizer.startRecording() }
///     }
/// }
/// Text(recognizer.transcript)
/// ```
@MainActor
final class SpeechRecognizer: ObservableObject {

    // MARK: - Published Properties

    /// The current transcription text, updated as the user speaks.
    @Published private(set) var transcript: String = ""

    /// Whether the recognizer is actively recording and transcribing.
    @Published private(set) var isRecording: Bool = false

    /// The most recent error, if any.
    @Published private(set) var error: SpeechRecognizerError?

    /// The current authorization status for speech recognition.
    @Published private(set) var authorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined

    // MARK: - Private Properties

    private var audioEngine = AVAudioEngine()
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private let speechRecognizer: SFSpeechRecognizer?

    private let logger = Logger(subsystem: "com.algonit.algo", category: "SpeechRecognizer")

    // MARK: - Initialization

    /// Creates a new speech recognizer.
    ///
    /// - Parameter locale: The locale for speech recognition. Defaults to US English.
    init(locale: Locale = Locale(identifier: "en-US")) {
        self.speechRecognizer = SFSpeechRecognizer(locale: locale)
    }

    // MARK: - Authorization

    /// Requests authorization for speech recognition.
    ///
    /// - Returns: The resulting authorization status.
    @discardableResult
    func requestAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        let status = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        authorizationStatus = status
        return status
    }

    // MARK: - Recording

    /// Starts capturing audio and performing speech recognition.
    ///
    /// This method:
    /// 1. Checks that the speech recognizer is available.
    /// 2. Requests speech recognition authorization if needed.
    /// 3. Configures the audio session for recording.
    /// 4. Installs an audio tap on the input node.
    /// 5. Begins the recognition task, publishing partial results.
    ///
    /// - Throws: `SpeechRecognizerError` if the recognizer is unavailable or not authorized.
    func startRecording() async throws {
        // Reset state
        transcript = ""
        error = nil

        guard let speechRecognizer, speechRecognizer.isAvailable else {
            let err = SpeechRecognizerError.recognizerUnavailable
            error = err
            throw err
        }

        // Check authorization
        let authStatus = await requestAuthorization()
        guard authStatus == .authorized else {
            let err = SpeechRecognizerError.notAuthorized
            error = err
            throw err
        }

        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            let err = SpeechRecognizerError.audioSessionFailed(error.localizedDescription)
            self.error = err
            throw err
        }

        // Create and configure the recognition request
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true

        // On-device recognition when available (iOS 17+)
        if speechRecognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        self.recognitionRequest = request

        // Install audio tap
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            request.append(buffer)
        }

        // Start the audio engine
        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            let err = SpeechRecognizerError.recordingFailed(error.localizedDescription)
            self.error = err
            throw err
        }

        isRecording = true
        logger.info("Speech recognition started")

        // Begin recognition
        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }

            if let result {
                Task { @MainActor in
                    self.transcript = result.bestTranscription.formattedString
                }
            }

            if error != nil || (result?.isFinal ?? false) {
                Task { @MainActor in
                    if let error {
                        self.logger.warning("Recognition ended: \(error.localizedDescription)")
                    }
                    self.stopRecording()
                }
            }
        }
    }

    /// Stops the current recording and recognition session.
    ///
    /// Safe to call even if not currently recording.
    func stopRecording() {
        guard isRecording else { return }

        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        isRecording = false

        // Deactivate audio session
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        logger.info("Speech recognition stopped")
    }

    /// Resets the recognizer state, clearing the transcript and any errors.
    func reset() {
        stopRecording()
        transcript = ""
        error = nil
    }
}

// MARK: - SpeechRecognizerError

/// Errors specific to speech recognition operations.
enum SpeechRecognizerError: LocalizedError, Equatable {
    /// The speech recognizer is not available on this device.
    case recognizerUnavailable

    /// The user has not granted speech recognition permission.
    case notAuthorized

    /// The audio session could not be configured.
    case audioSessionFailed(String)

    /// The audio engine failed to start recording.
    case recordingFailed(String)

    var errorDescription: String? {
        switch self {
        case .recognizerUnavailable:
            return "Speech recognition is not available on this device."
        case .notAuthorized:
            return "Microphone and speech recognition access are required for voice input. Please enable them in Settings."
        case .audioSessionFailed(let reason):
            return "Failed to configure audio session: \(reason)"
        case .recordingFailed(let reason):
            return "Failed to start recording: \(reason)"
        }
    }
}
