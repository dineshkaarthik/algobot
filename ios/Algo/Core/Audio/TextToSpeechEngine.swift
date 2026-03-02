// TextToSpeechEngine.swift
// Algo
//
// Text-to-speech engine using AVSpeechSynthesizer.
// Plays AI assistant responses aloud with configurable voice,
// rate, and pitch. Supports pause, resume, and stop controls.

import Foundation
import AVFoundation
import os

/// Provides text-to-speech playback for AI assistant responses.
///
/// Uses `AVSpeechSynthesizer` to convert text into spoken audio with
/// configurable voice, speech rate, and pitch. Publishes playback state
/// for SwiftUI binding.
///
/// Usage:
/// ```swift
/// @StateObject var tts = TextToSpeechEngine()
///
/// Button(tts.isSpeaking ? "Stop" : "Listen") {
///     if tts.isSpeaking {
///         tts.stop()
///     } else {
///         tts.speak("Your campaigns are performing well today.")
///     }
/// }
/// ```
@MainActor
final class TextToSpeechEngine: NSObject, ObservableObject {

    // MARK: - Published Properties

    /// Whether the engine is currently speaking.
    @Published private(set) var isSpeaking: Bool = false

    /// Whether speech is paused (can be resumed).
    @Published private(set) var isPaused: Bool = false

    /// The progress of the current utterance (0.0 to 1.0).
    @Published private(set) var progress: Double = 0.0

    // MARK: - Configuration

    /// The speech rate (0.0 to 1.0). Default is a natural conversational speed.
    var rate: Float = AVSpeechUtteranceDefaultSpeechRate

    /// The pitch multiplier (0.5 to 2.0). Default is 1.0 (natural pitch).
    var pitchMultiplier: Float = 1.0

    /// The volume (0.0 to 1.0). Default is 1.0 (full volume).
    var volume: Float = 1.0

    /// The preferred voice identifier. Set to `nil` to use the system default.
    ///
    /// Use `TextToSpeechEngine.availableVoices()` to get valid identifiers.
    var preferredVoiceIdentifier: String?

    // MARK: - Private Properties

    private let synthesizer = AVSpeechSynthesizer()
    private var currentUtteranceLength: Int = 0
    private let logger = Logger(subsystem: "com.algonit.algo", category: "TTS")

    // MARK: - Initialization

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    // MARK: - Playback Control

    /// Speaks the given text aloud.
    ///
    /// If currently speaking, the current utterance is stopped before starting
    /// the new one. Configures the audio session for playback automatically.
    ///
    /// - Parameter text: The text to speak.
    func speak(_ text: String) {
        // Stop any current speech
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }

        guard !text.isEmpty else { return }

        // Configure audio session for playback
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .spokenContent, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            logger.error("Failed to configure audio session: \(error.localizedDescription)")
        }

        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = rate
        utterance.pitchMultiplier = pitchMultiplier
        utterance.volume = volume
        utterance.prefersAssistiveTechnologySettings = false

        // Set voice
        if let voiceId = preferredVoiceIdentifier,
           let voice = AVSpeechSynthesisVoice(identifier: voiceId) {
            utterance.voice = voice
        } else {
            // Use a high-quality English voice if available
            utterance.voice = Self.preferredEnglishVoice()
        }

        currentUtteranceLength = text.count
        progress = 0.0

        synthesizer.speak(utterance)
        logger.info("Speaking text (\(text.count) characters)")
    }

    /// Pauses the current speech at the next word boundary.
    func pause() {
        guard isSpeaking, !isPaused else { return }
        synthesizer.pauseSpeaking(at: .word)
    }

    /// Resumes speech after a pause.
    func resume() {
        guard isPaused else { return }
        synthesizer.continueSpeaking()
    }

    /// Stops speech immediately.
    func stop() {
        guard synthesizer.isSpeaking || isPaused else { return }
        synthesizer.stopSpeaking(at: .immediate)
        deactivateAudioSession()
    }

    // MARK: - Voice Discovery

    /// Returns available speech synthesis voices for the given language.
    ///
    /// - Parameter languageCode: The language code (e.g., "en-US"). Defaults to "en-US".
    /// - Returns: An array of available voices.
    static func availableVoices(for languageCode: String = "en-US") -> [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices().filter { $0.language == languageCode }
    }

    /// Returns a high-quality English voice if available, otherwise the default.
    private static func preferredEnglishVoice() -> AVSpeechSynthesisVoice? {
        let voices = availableVoices()

        // Prefer premium/enhanced voices
        if let premium = voices.first(where: { $0.quality == .premium }) {
            return premium
        }
        if let enhanced = voices.first(where: { $0.quality == .enhanced }) {
            return enhanced
        }

        return voices.first ?? AVSpeechSynthesisVoice(language: "en-US")
    }

    // MARK: - Audio Session

    private func deactivateAudioSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

// MARK: - AVSpeechSynthesizerDelegate

extension TextToSpeechEngine: AVSpeechSynthesizerDelegate {

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didStart utterance: AVSpeechUtterance
    ) {
        Task { @MainActor in
            self.isSpeaking = true
            self.isPaused = false
            self.progress = 0.0
        }
    }

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didFinish utterance: AVSpeechUtterance
    ) {
        Task { @MainActor in
            self.isSpeaking = false
            self.isPaused = false
            self.progress = 1.0
            self.deactivateAudioSession()
            self.logger.info("Speech finished")
        }
    }

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didPause utterance: AVSpeechUtterance
    ) {
        Task { @MainActor in
            self.isPaused = true
        }
    }

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didContinue utterance: AVSpeechUtterance
    ) {
        Task { @MainActor in
            self.isPaused = false
        }
    }

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        didCancel utterance: AVSpeechUtterance
    ) {
        Task { @MainActor in
            self.isSpeaking = false
            self.isPaused = false
            self.progress = 0.0
            self.deactivateAudioSession()
        }
    }

    nonisolated func speechSynthesizer(
        _ synthesizer: AVSpeechSynthesizer,
        willSpeakRangeOfSpeechString characterRange: NSRange,
        utterance: AVSpeechUtterance
    ) {
        Task { @MainActor in
            guard self.currentUtteranceLength > 0 else { return }
            let spokenUpTo = characterRange.location + characterRange.length
            self.progress = Double(spokenUpTo) / Double(self.currentUtteranceLength)
        }
    }
}
