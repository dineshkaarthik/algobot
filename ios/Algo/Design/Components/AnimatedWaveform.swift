// AnimatedWaveform.swift
// Algo
//
// Animated sound wave visualization used during voice recording.
// Displays oscillating bars with a pulsing effect to indicate active recording.

import SwiftUI

// MARK: - AnimatedWaveform

/// Displays animated vertical bars that oscillate to represent audio input.
///
/// Usage:
/// ```swift
/// AnimatedWaveform(isAnimating: isRecording, barCount: 5)
///     .frame(height: 32)
/// ```
struct AnimatedWaveform: View {

    // MARK: Properties

    /// Whether the waveform animation is active.
    let isAnimating: Bool

    /// Number of bars in the waveform. Defaults to 5.
    let barCount: Int

    /// Color of the bars. Defaults to accent color.
    let color: Color

    @State private var animationPhases: [Double]

    // MARK: Initialization

    init(isAnimating: Bool, barCount: Int = 5, color: Color = .accentColor) {
        self.isAnimating = isAnimating
        self.barCount = barCount
        self.color = color
        self._animationPhases = State(initialValue: Array(repeating: 0.3, count: barCount))
    }

    // MARK: Body

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<barCount, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(color)
                    .frame(width: 3, height: barHeight(for: index))
            }
        }
        .frame(height: 24)
        .onChange(of: isAnimating) { _, newValue in
            if newValue {
                startAnimation()
            } else {
                resetBars()
            }
        }
        .onAppear {
            if isAnimating {
                startAnimation()
            }
        }
    }

    // MARK: Private Helpers

    private func barHeight(for index: Int) -> CGFloat {
        let phase = animationPhases[index]
        return max(4, 24 * phase)
    }

    private func startAnimation() {
        for index in 0..<barCount {
            let delay = Double(index) * 0.1
            withAnimation(
                .easeInOut(duration: 0.4)
                .repeatForever(autoreverses: true)
                .delay(delay)
            ) {
                animationPhases[index] = Double.random(in: 0.3...1.0)
            }
        }
    }

    private func resetBars() {
        withAnimation(.easeOut(duration: 0.2)) {
            for index in 0..<barCount {
                animationPhases[index] = 0.3
            }
        }
    }
}

// MARK: - PulsingRecordIndicator

/// A pulsing circle indicator shown during active voice recording.
/// Combines the waveform with a pulsing background circle.
struct PulsingRecordIndicator: View {

    /// Whether recording is active.
    let isRecording: Bool

    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.6

    var body: some View {
        ZStack {
            // Pulse ring
            Circle()
                .fill(AlgoTheme.Colors.error.opacity(pulseOpacity * 0.3))
                .scaleEffect(pulseScale)

            // Inner circle
            Circle()
                .fill(AlgoTheme.Colors.error)
                .frame(width: 48, height: 48)

            // Waveform overlay
            AnimatedWaveform(
                isAnimating: isRecording,
                barCount: 3,
                color: .white
            )
            .frame(width: 20, height: 20)
        }
        .frame(width: 64, height: 64)
        .onChange(of: isRecording) { _, recording in
            if recording {
                withAnimation(
                    .easeInOut(duration: 1.0)
                    .repeatForever(autoreverses: true)
                ) {
                    pulseScale = 1.3
                    pulseOpacity = 0.0
                }
            } else {
                withAnimation(.easeOut(duration: 0.3)) {
                    pulseScale = 1.0
                    pulseOpacity = 0.6
                }
            }
        }
    }
}

// MARK: - Preview

#Preview("Waveform Animations") {
    VStack(spacing: 20) {
        AnimatedWaveform(isAnimating: true)
        AnimatedWaveform(isAnimating: false)
        AnimatedWaveform(isAnimating: true, barCount: 7, color: .red)

        PulsingRecordIndicator(isRecording: true)
    }
    .padding()
}
