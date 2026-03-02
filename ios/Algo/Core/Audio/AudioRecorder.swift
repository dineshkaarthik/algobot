// AudioRecorder.swift
// Algo
//
// Records audio to a temporary .m4a file using AVAudioRecorder.
// Designed for capturing voice input to upload to the Algo backend
// for server-side transcription via Whisper STT.

import Foundation
import AVFoundation
import os

/// Records audio from the microphone to a temporary .m4a file.
///
/// Captures voice input with a configurable maximum duration (default 60 seconds).
/// After recording, the file URL can be used to upload the audio to the backend.
///
/// Usage:
/// ```swift
/// @StateObject var recorder = AudioRecorder()
///
/// Button(recorder.isRecording ? "Stop" : "Record") {
///     if recorder.isRecording {
///         recorder.stopRecording()
///     } else {
///         Task { try await recorder.startRecording() }
///     }
/// }
///
/// if let url = recorder.recordingURL {
///     // Upload url to /audio/upload
/// }
/// ```
@MainActor
final class AudioRecorder: NSObject, ObservableObject {

    // MARK: - Published Properties

    /// Whether the recorder is currently capturing audio.
    @Published private(set) var isRecording: Bool = false

    /// The duration of the current recording in seconds.
    @Published private(set) var recordingDuration: TimeInterval = 0

    /// The URL of the last completed recording, or `nil` if no recording exists.
    @Published private(set) var recordingURL: URL?

    /// The most recent error, if any.
    @Published private(set) var error: AudioRecorderError?

    // MARK: - Configuration

    /// The maximum recording duration in seconds. Defaults to 60.
    let maxDuration: TimeInterval

    // MARK: - Private Properties

    private var audioRecorder: AVAudioRecorder?
    private var durationTimer: Timer?
    private var recordingStartTime: Date?

    private let logger = Logger(subsystem: "com.algonit.algo", category: "AudioRecorder")

    /// Audio recording settings optimized for speech recognition.
    private let recordingSettings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 44100.0,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        AVEncoderBitRateKey: 128000
    ]

    // MARK: - Initialization

    /// Creates a new audio recorder.
    ///
    /// - Parameter maxDuration: Maximum recording duration in seconds. Defaults to 60.
    init(maxDuration: TimeInterval = AppConfiguration.maxRecordingDuration) {
        self.maxDuration = maxDuration
        super.init()
    }

    // MARK: - Recording

    /// Starts recording audio to a temporary .m4a file.
    ///
    /// This method:
    /// 1. Requests microphone permission if not already granted.
    /// 2. Configures the audio session for recording.
    /// 3. Creates a temporary file and begins recording.
    /// 4. Starts a timer to track duration and enforce the max limit.
    ///
    /// - Throws: `AudioRecorderError` if the microphone is unavailable or recording fails.
    func startRecording() async throws {
        // Reset state
        error = nil
        recordingDuration = 0
        recordingURL = nil

        // Request microphone permission
        let granted = await requestMicrophonePermission()
        guard granted else {
            let err = AudioRecorderError.microphoneNotAuthorized
            error = err
            throw err
        }

        // Configure audio session
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            let err = AudioRecorderError.audioSessionFailed(error.localizedDescription)
            self.error = err
            throw err
        }

        // Create temporary file URL
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "algo_recording_\(UUID().uuidString).m4a"
        let fileURL = tempDir.appendingPathComponent(fileName)

        // Clean up previous recording file
        cleanUpPreviousRecording()

        // Create and configure the recorder
        do {
            audioRecorder = try AVAudioRecorder(url: fileURL, settings: recordingSettings)
            audioRecorder?.delegate = self
            audioRecorder?.isMeteringEnabled = true

            guard audioRecorder?.prepareToRecord() == true else {
                throw AudioRecorderError.recordingFailed("Failed to prepare recorder")
            }

            guard audioRecorder?.record() == true else {
                throw AudioRecorderError.recordingFailed("Failed to start recording")
            }
        } catch let recorderError as AudioRecorderError {
            error = recorderError
            throw recorderError
        } catch {
            let err = AudioRecorderError.recordingFailed(error.localizedDescription)
            self.error = err
            throw err
        }

        isRecording = true
        recordingStartTime = Date()
        recordingURL = fileURL

        // Start duration tracking timer
        startDurationTimer()

        logger.info("Recording started at: \(fileURL.lastPathComponent)")
    }

    /// Stops the current recording.
    ///
    /// After stopping, `recordingURL` contains the path to the .m4a file.
    /// Safe to call even if not currently recording.
    func stopRecording() {
        guard isRecording else { return }

        audioRecorder?.stop()
        stopDurationTimer()
        isRecording = false

        // Deactivate audio session
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        if let startTime = recordingStartTime {
            recordingDuration = Date().timeIntervalSince(startTime)
        }

        logger.info("Recording stopped. Duration: \(self.recordingDuration)s")
    }

    /// Cancels the current recording and deletes the file.
    func cancelRecording() {
        stopRecording()
        cleanUpPreviousRecording()
        recordingURL = nil
        recordingDuration = 0
    }

    /// Deletes the current recording file from disk.
    func deleteRecording() {
        cleanUpPreviousRecording()
        recordingURL = nil
        recordingDuration = 0
    }

    // MARK: - Permissions

    /// Requests microphone permission.
    ///
    /// - Returns: `true` if the user has granted microphone access.
    private func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    // MARK: - Duration Timer

    /// Starts a repeating timer that updates `recordingDuration` and enforces the max limit.
    private func startDurationTimer() {
        stopDurationTimer()
        durationTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let startTime = self.recordingStartTime else { return }

                self.recordingDuration = Date().timeIntervalSince(startTime)

                // Auto-stop at max duration
                if self.recordingDuration >= self.maxDuration {
                    self.logger.info("Max recording duration reached (\(self.maxDuration)s)")
                    self.stopRecording()
                }
            }
        }
    }

    /// Stops the duration tracking timer.
    private func stopDurationTimer() {
        durationTimer?.invalidate()
        durationTimer = nil
    }

    // MARK: - Cleanup

    /// Removes the previous recording file from disk.
    private func cleanUpPreviousRecording() {
        if let url = recordingURL {
            try? FileManager.default.removeItem(at: url)
        }
    }
}

// MARK: - AVAudioRecorderDelegate

extension AudioRecorder: AVAudioRecorderDelegate {

    nonisolated func audioRecorderDidFinishRecording(
        _ recorder: AVAudioRecorder,
        successfully flag: Bool
    ) {
        Task { @MainActor in
            if !flag {
                self.logger.error("Recording did not finish successfully")
                self.error = .recordingFailed("Recording was interrupted")
            }
            self.isRecording = false
            self.stopDurationTimer()
        }
    }

    nonisolated func audioRecorderEncodeErrorDidOccur(
        _ recorder: AVAudioRecorder,
        error: (any Error)?
    ) {
        Task { @MainActor in
            self.logger.error("Recording encode error: \(error?.localizedDescription ?? "unknown")")
            self.error = .encodingFailed(error?.localizedDescription ?? "Unknown encoding error")
            self.isRecording = false
            self.stopDurationTimer()
        }
    }
}

// MARK: - AudioRecorderError

/// Errors specific to audio recording operations.
enum AudioRecorderError: LocalizedError, Equatable {
    /// The user has not granted microphone access.
    case microphoneNotAuthorized

    /// The audio session could not be configured.
    case audioSessionFailed(String)

    /// The recorder failed to start or was interrupted.
    case recordingFailed(String)

    /// The recorded audio could not be encoded to the target format.
    case encodingFailed(String)

    var errorDescription: String? {
        switch self {
        case .microphoneNotAuthorized:
            return "Microphone access is required for voice recording. Please enable it in Settings."
        case .audioSessionFailed(let reason):
            return "Failed to configure audio: \(reason)"
        case .recordingFailed(let reason):
            return "Recording failed: \(reason)"
        case .encodingFailed(let reason):
            return "Audio encoding failed: \(reason)"
        }
    }
}
