// AlgoTextField.swift
// Algo
//
// Styled text field component with label, placeholder, error message,
// and secure field support. Provides consistent input styling across the app.

import SwiftUI

// MARK: - Validation State

/// Represents the visual validation state of a text field.
enum AlgoTextFieldState {
    /// Default idle state.
    case idle
    /// Field has valid content.
    case valid
    /// Field has invalid content with an associated error message.
    case error(String)
}

// MARK: - AlgoTextField

/// A styled text input component used throughout the Algo app.
///
/// Usage:
/// ```swift
/// AlgoTextField(
///     "Email",
///     text: $email,
///     placeholder: "you@example.com",
///     icon: "envelope",
///     state: emailError.map { .error($0) } ?? .idle
/// )
/// ```
struct AlgoTextField: View {

    // MARK: Properties

    let label: String
    @Binding var text: String
    let placeholder: String
    let icon: String?
    let isSecure: Bool
    let state: AlgoTextFieldState
    let keyboardType: UIKeyboardType
    let textContentType: UITextContentType?
    let onSubmit: (() -> Void)?

    @State private var isSecureVisible = false
    @FocusState private var isFocused: Bool

    // MARK: Initialization

    /// Creates a new `AlgoTextField`.
    /// - Parameters:
    ///   - label: The label displayed above the field.
    ///   - text: Binding to the text value.
    ///   - placeholder: Placeholder text shown when empty.
    ///   - icon: Optional SF Symbol displayed at the leading edge.
    ///   - isSecure: Whether to mask the input (password mode). Defaults to `false`.
    ///   - state: Current validation state. Defaults to `.idle`.
    ///   - keyboardType: Keyboard type for the field. Defaults to `.default`.
    ///   - textContentType: Autofill content type hint. Defaults to `nil`.
    ///   - onSubmit: Optional closure called when the return key is pressed.
    init(
        _ label: String,
        text: Binding<String>,
        placeholder: String = "",
        icon: String? = nil,
        isSecure: Bool = false,
        state: AlgoTextFieldState = .idle,
        keyboardType: UIKeyboardType = .default,
        textContentType: UITextContentType? = nil,
        onSubmit: (() -> Void)? = nil
    ) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.icon = icon
        self.isSecure = isSecure
        self.state = state
        self.keyboardType = keyboardType
        self.textContentType = textContentType
        self.onSubmit = onSubmit
    }

    // MARK: Body

    var body: some View {
        VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxs) {
            // Label
            Text(label)
                .font(AlgoTypography.labelMedium)
                .foregroundStyle(AlgoTheme.Colors.textSecondary)

            // Input container
            HStack(spacing: AlgoTheme.Spacing.xs) {
                // Leading icon
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16))
                        .foregroundStyle(iconColor)
                        .frame(width: 20)
                }

                // Text input
                if isSecure && !isSecureVisible {
                    SecureField(placeholder, text: $text)
                        .textContentType(textContentType)
                        .focused($isFocused)
                        .onSubmit { onSubmit?() }
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                        .textContentType(textContentType)
                        .autocorrectionDisabled(isSecure)
                        .textInputAutocapitalization(isSecure ? .never : .sentences)
                        .focused($isFocused)
                        .onSubmit { onSubmit?() }
                }

                // Secure toggle
                if isSecure {
                    Button {
                        isSecureVisible.toggle()
                    } label: {
                        Image(systemName: isSecureVisible ? "eye.slash" : "eye")
                            .font(.system(size: 15))
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }
                }
            }
            .padding(.horizontal, AlgoTheme.Spacing.sm)
            .padding(.vertical, AlgoTheme.Spacing.sm)
            .background(AlgoTheme.Colors.secondaryBackground)
            .clipShape(RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm))
            .overlay {
                RoundedRectangle(cornerRadius: AlgoTheme.CornerRadius.sm)
                    .strokeBorder(borderColor, lineWidth: isFocused ? 1.5 : 1)
            }
            .animation(AlgoTheme.Animation.fast, value: isFocused)

            // Error message
            if case .error(let message) = state {
                HStack(spacing: AlgoTheme.Spacing.xxs) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 12))
                    Text(message)
                        .font(AlgoTypography.caption)
                }
                .foregroundStyle(AlgoTheme.Colors.error)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(AlgoTheme.Animation.fast, value: stateKey)
    }

    // MARK: Style Helpers

    private var borderColor: Color {
        if isFocused {
            return AlgoTheme.Colors.primary
        }
        switch state {
        case .idle:
            return AlgoTheme.Colors.divider
        case .valid:
            return AlgoTheme.Colors.success
        case .error:
            return AlgoTheme.Colors.error
        }
    }

    private var iconColor: Color {
        if isFocused {
            return AlgoTheme.Colors.primary
        }
        switch state {
        case .error:
            return AlgoTheme.Colors.error
        default:
            return AlgoTheme.Colors.textTertiary
        }
    }

    /// A hashable key derived from the state for animation tracking.
    private var stateKey: String {
        switch state {
        case .idle: return "idle"
        case .valid: return "valid"
        case .error(let msg): return "error-\(msg)"
        }
    }
}

// MARK: - Preview

#Preview("Text Fields") {
    VStack(spacing: 20) {
        AlgoTextField(
            "Email",
            text: .constant(""),
            placeholder: "you@example.com",
            icon: "envelope"
        )

        AlgoTextField(
            "Password",
            text: .constant("secret"),
            placeholder: "Enter password",
            icon: "lock",
            isSecure: true
        )

        AlgoTextField(
            "Name",
            text: .constant("John"),
            placeholder: "Your name",
            state: .valid
        )

        AlgoTextField(
            "Email",
            text: .constant("bad-email"),
            placeholder: "you@example.com",
            icon: "envelope",
            state: .error("Please enter a valid email address")
        )
    }
    .padding()
}
