// VoiceInputButton.swift
// Algo
//
// A hold-to-record voice input button with animated waveform feedback.
// Uses SpeechRecognizer for real-time speech-to-text transcription.
// Visual states: idle, recording, processing.

import SwiftUI

// MARK: - VoiceInputButton

struct VoiceInputButton: View {

    // MARK: - Properties

    /// Binding to track whether recording is currently active.
    @Binding var isRecording: Bool

    /// Callback invoked with the transcribed text when recording completes.
    let onTranscription: (String) -> Void

    @StateObject private var speechRecognizer = SpeechRecognizer()
    @State private var isProcessing = false
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var pulseScale: CGFloat = 1.0

    // MARK: - Body

    var body: some View {
        Button {
            // Tap toggles recording on/off
            if isRecording {
                stopRecordingAndTranscribe()
            } else {
                startRecording()
            }
        } label: {
            ZStack {
                // Pulsing background circle when recording
                if isRecording {
                    Circle()
                        .fill(AlgoTheme.Colors.error.opacity(0.15))
                        .frame(width: 48, height: 48)
                        .scaleEffect(pulseScale)
                }

                // Main button circle
                Circle()
                    .fill(buttonBackgroundColor)
                    .frame(width: 36, height: 36)

                // Icon or waveform
                if isRecording {
                    AnimatedWaveform(
                        isAnimating: true,
                        barCount: 3,
                        color: .white
                    )
                    .frame(width: 16, height: 16)
                } else if isProcessing {
                    ProgressView()
                        .controlSize(.small)
                        .tint(.white)
                } else {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(.plain)
        .simultaneousGesture(
            LongPressGesture(minimumDuration: 0.3)
                .onEnded { _ in
                    if !isRecording {
                        startRecording()
                    }
                }
        )
        .onChange(of: isRecording) { _, recording in
            if recording {
                startPulseAnimation()
            } else {
                stopPulseAnimation()
            }
        }
        .alert("Voice Input Error", isPresented: $showError) {
            Button("OK") {}
        } message: {
            Text(errorMessage)
        }
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityHint(accessibilityHintText)
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Recording Control

    private func startRecording() {
        isRecording = true
        isProcessing = false

        Task {
            do {
                try await speechRecognizer.startRecording()
            } catch {
                isRecording = false
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }

    private func stopRecordingAndTranscribe() {
        isRecording = false
        isProcessing = true

        speechRecognizer.stopRecording()

        // Allow a brief moment for any final transcription to settle
        Task {
            try? await Task.sleep(for: .milliseconds(300))

            let transcript = speechRecognizer.transcript.trimmingCharacters(
                in: .whitespacesAndNewlines
            )

            isProcessing = false

            if !transcript.isEmpty {
                onTranscription(transcript)
            }
        }
    }

    // MARK: - Pulse Animation

    private func startPulseAnimation() {
        withAnimation(
            .easeInOut(duration: 0.8)
            .repeatForever(autoreverses: true)
        ) {
            pulseScale = 1.2
        }
    }

    private func stopPulseAnimation() {
        withAnimation(.easeOut(duration: 0.2)) {
            pulseScale = 1.0
        }
    }

    // MARK: - Styling

    private var buttonBackgroundColor: Color {
        if isRecording {
            return AlgoTheme.Colors.error
        } else if isProcessing {
            return AlgoTheme.Colors.primary.opacity(0.7)
        } else {
            return AlgoTheme.Colors.primary
        }
    }

    // MARK: - Accessibility

    private var accessibilityLabelText: String {
        if isRecording {
            return "Stop recording"
        } else if isProcessing {
            return "Processing voice input"
        } else {
            return "Voice input"
        }
    }

    private var accessibilityHintText: String {
        if isRecording {
            return "Tap to stop recording and send your message"
        } else {
            return "Tap to start voice recording, or press and hold"
        }
    }
}

// MARK: - Preview

#Preview("Voice Input Button") {
    HStack(spacing: 20) {
        VoiceInputButton(isRecording: .constant(false)) { text in
            print("Transcribed: \(text)")
        }

        VoiceInputButton(isRecording: .constant(true)) { text in
            print("Transcribed: \(text)")
        }
    }
    .padding()
}
