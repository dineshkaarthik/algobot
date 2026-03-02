// SettingsView.swift
// Algo
//
// Settings screen with sections for Account, Notifications, About, and Logout.
// Uses standard iOS grouped list styling.

import SwiftUI

// MARK: - SettingsView

/// The main settings screen providing access to account info,
/// notification preferences, app information, and logout.
struct SettingsView: View {

    // MARK: Properties

    @ObservedObject var viewModel: SettingsViewModel
    @EnvironmentObject private var authViewModel: AuthViewModel
    @AppStorage("appColorScheme") private var colorSchemeRaw = AppColorScheme.system.rawValue
    @State private var showLogoutConfirmation = false

    // MARK: Body

    var body: some View {
        NavigationStack {
            List {
                accountSection
                appearanceSection
                securitySection
                notificationsSection
                aboutSection
                logoutSection
            }
            .navigationTitle("Settings")
            .alert("Log Out", isPresented: $showLogoutConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Log Out", role: .destructive) {
                    Task { await viewModel.logout() }
                }
            } message: {
                Text("Are you sure you want to log out? You will need to sign in again to use Algo.")
            }
        }
        .task {
            await viewModel.loadSettings()
        }
    }

    // MARK: Account Section

    private var accountSection: some View {
        Section {
            if let user = viewModel.user {
                HStack(spacing: AlgoTheme.Spacing.sm) {
                    // Avatar
                    ZStack {
                        Circle()
                            .fill(AlgoTheme.Colors.primary.opacity(0.15))
                            .frame(width: 56, height: 56)

                        Text(initials(from: user.name))
                            .font(AlgoTypography.titleMedium)
                            .foregroundStyle(AlgoTheme.Colors.primary)
                    }

                    VStack(alignment: .leading, spacing: AlgoTheme.Spacing.xxxs) {
                        Text(user.name)
                            .font(AlgoTypography.titleSmall)
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)

                        Text(user.email)
                            .font(AlgoTypography.bodySmall)
                            .foregroundStyle(AlgoTheme.Colors.textSecondary)

                        Text(user.role.capitalized)
                            .font(AlgoTypography.labelSmall)
                            .foregroundStyle(AlgoTheme.Colors.primary)
                            .padding(.horizontal, AlgoTheme.Spacing.xs)
                            .padding(.vertical, 2)
                            .background(AlgoTheme.Colors.primary.opacity(0.1))
                            .clipShape(Capsule())
                    }
                }
                .padding(.vertical, AlgoTheme.Spacing.xxs)
            } else {
                HStack {
                    ProgressView()
                    Text("Loading profile...")
                        .font(AlgoTypography.bodyMedium)
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
            }
        } header: {
            Text("Account")
        }
    }

    // MARK: Appearance Section

    private var appearanceSection: some View {
        Section {
            Picker(selection: $colorSchemeRaw) {
                ForEach(AppColorScheme.allCases, id: \.rawValue) { scheme in
                    Text(scheme.displayName).tag(scheme.rawValue)
                }
            } label: {
                Label {
                    Text("Appearance")
                } icon: {
                    Image(systemName: "circle.lefthalf.filled")
                        .foregroundStyle(AlgoTheme.Colors.primary)
                }
            }
        } header: {
            Text("Appearance")
        }
    }

    // MARK: Security Section

    private var securitySection: some View {
        Section {
            if authViewModel.isBiometricAvailable {
                Toggle(isOn: $authViewModel.biometricEnabled) {
                    Label {
                        Text(biometricToggleLabel)
                    } icon: {
                        Image(systemName: biometricIconName)
                            .foregroundStyle(AlgoTheme.Colors.primary)
                    }
                }
                .tint(AlgoTheme.Colors.primary)
            } else {
                Label {
                    Text("Biometric authentication is not available on this device.")
                        .font(AlgoTypography.bodySmall)
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                } icon: {
                    Image(systemName: "lock.slash")
                        .foregroundStyle(AlgoTheme.Colors.textTertiary)
                }
            }
        } header: {
            Text("Security")
        }
    }

    /// Returns the appropriate SF Symbol name for the device's biometric type.
    private var biometricIconName: String {
        switch authViewModel.biometricType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        default: return "lock.shield"
        }
    }

    /// Returns a user-friendly label for the biometric toggle.
    private var biometricToggleLabel: String {
        switch authViewModel.biometricType {
        case .faceID: return "Unlock with Face ID"
        case .touchID: return "Unlock with Touch ID"
        default: return "Biometric Unlock"
        }
    }

    // MARK: Notifications Section

    private var notificationsSection: some View {
        Section {
            NavigationLink {
                NotificationPreferencesView(viewModel: viewModel)
            } label: {
                Label {
                    Text("Notification Preferences")
                } icon: {
                    Image(systemName: "bell.badge")
                        .foregroundStyle(AlgoTheme.Colors.primary)
                }
            }

            NavigationLink {
                // Placeholder for push notification system settings
                Text("System notification settings are managed in the Settings app.")
                    .padding()
                    .navigationTitle("Push Notifications")
            } label: {
                Label {
                    Text("Push Notifications")
                } icon: {
                    Image(systemName: "iphone.radiowaves.left.and.right")
                        .foregroundStyle(AlgoTheme.Colors.primary)
                }
            }
        } header: {
            Text("Notifications")
        }
    }

    // MARK: About Section

    private var aboutSection: some View {
        Section {
            HStack {
                Label {
                    Text("Version")
                } icon: {
                    Image(systemName: "info.circle")
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
                Spacer()
                Text(appVersion)
                    .font(AlgoTypography.bodySmall)
                    .foregroundStyle(AlgoTheme.Colors.textSecondary)
            }

            Link(destination: URL(string: "https://www.algonit.com")!) {
                Label {
                    HStack {
                        Text("Algonit Website")
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .font(.system(size: 14))
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }
                } icon: {
                    Image(systemName: "globe")
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
            }

            Link(destination: URL(string: "https://www.algonit.com/privacy")!) {
                Label {
                    HStack {
                        Text("Privacy Policy")
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .font(.system(size: 14))
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }
                } icon: {
                    Image(systemName: "hand.raised")
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
            }

            Link(destination: URL(string: "https://www.algonit.com/terms")!) {
                Label {
                    HStack {
                        Text("Terms of Service")
                            .foregroundStyle(AlgoTheme.Colors.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right.square")
                            .font(.system(size: 14))
                            .foregroundStyle(AlgoTheme.Colors.textTertiary)
                    }
                } icon: {
                    Image(systemName: "doc.text")
                        .foregroundStyle(AlgoTheme.Colors.textSecondary)
                }
            }
        } header: {
            Text("About")
        }
    }

    // MARK: Logout Section

    private var logoutSection: some View {
        Section {
            Button(role: .destructive) {
                showLogoutConfirmation = true
            } label: {
                HStack {
                    Spacer()
                    Label("Log Out", systemImage: "rectangle.portrait.and.arrow.right")
                        .font(AlgoTypography.labelLarge)
                    Spacer()
                }
            }
        }
    }

    // MARK: Helpers

    /// Extracts initials from a full name.
    private func initials(from name: String) -> String {
        let components = name.split(separator: " ")
        let first = components.first?.prefix(1) ?? ""
        let last = components.count > 1 ? components.last?.prefix(1) ?? "" : ""
        return "\(first)\(last)".uppercased()
    }

    /// Current app version from the bundle.
    private var appVersion: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

// MARK: - Preview

#Preview("Settings") {
    let vm = SettingsViewModel(tokenProvider: { "mock_token" }, onLogout: {})
    vm.setUser(UserInfo(
        id: "usr_001",
        email: "john@company.com",
        name: "John Doe",
        role: "admin",
        tenantId: "ten_001",
        avatarUrl: nil
    ))
    return SettingsView(viewModel: vm)
}
