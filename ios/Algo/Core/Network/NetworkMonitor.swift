// NetworkMonitor.swift
// Algo
//
// Monitors network connectivity using NWPathMonitor.
// Publishes connection status changes for SwiftUI observation.
// Used to show offline banners and disable network-dependent features.

import Foundation
import Network
import os

/// Monitors the device's network connectivity and publishes changes.
///
/// Uses Apple's `NWPathMonitor` to detect when the device goes online or offline,
/// and what type of connection is active (WiFi, cellular, etc.).
///
/// Usage:
/// ```swift
/// // In SwiftUI
/// @EnvironmentObject var networkMonitor: NetworkMonitor
///
/// if !networkMonitor.isConnected {
///     OfflineBannerView()
/// }
/// ```
@MainActor
final class NetworkMonitor: ObservableObject {

    // MARK: - Published Properties

    /// Whether the device currently has network connectivity.
    @Published private(set) var isConnected: Bool = true

    /// The type of the current network connection.
    @Published private(set) var connectionType: ConnectionType = .unknown

    /// Whether the current connection is considered "expensive" (cellular or hotspot).
    @Published private(set) var isExpensive: Bool = false

    /// Whether the current connection is "constrained" (Low Data Mode).
    @Published private(set) var isConstrained: Bool = false

    // MARK: - Connection Type

    /// Describes the type of network connection.
    enum ConnectionType: String {
        case wifi
        case cellular
        case wiredEthernet
        case unknown

        var displayName: String {
            switch self {
            case .wifi: return "Wi-Fi"
            case .cellular: return "Cellular"
            case .wiredEthernet: return "Ethernet"
            case .unknown: return "Unknown"
            }
        }
    }

    // MARK: - Private Properties

    private let monitor: NWPathMonitor
    private let monitorQueue = DispatchQueue(label: "com.algonit.algo.networkMonitor")
    private let logger = Logger(subsystem: "com.algonit.algo", category: "NetworkMonitor")

    // MARK: - Initialization

    /// Creates and starts the network monitor.
    init() {
        self.monitor = NWPathMonitor()
        startMonitoring()
    }

    deinit {
        monitor.cancel()
    }

    // MARK: - Monitoring

    /// Starts observing network path changes.
    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }

                let wasConnected = self.isConnected
                self.isConnected = path.status == .satisfied
                self.isExpensive = path.isExpensive
                self.isConstrained = path.isConstrained

                // Determine connection type
                if path.usesInterfaceType(.wifi) {
                    self.connectionType = .wifi
                } else if path.usesInterfaceType(.cellular) {
                    self.connectionType = .cellular
                } else if path.usesInterfaceType(.wiredEthernet) {
                    self.connectionType = .wiredEthernet
                } else {
                    self.connectionType = .unknown
                }

                // Log state transitions
                if wasConnected != self.isConnected {
                    if self.isConnected {
                        self.logger.info("Network restored via \(self.connectionType.rawValue)")
                    } else {
                        self.logger.warning("Network connection lost")
                    }
                }
            }
        }
        monitor.start(queue: monitorQueue)
    }
}
