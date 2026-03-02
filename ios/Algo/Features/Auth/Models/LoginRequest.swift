// LoginRequest.swift
// Algo
//
// Request models for login and registration endpoints.

import Foundation

// MARK: - LoginRequest

/// Request body for POST /auth/login.
struct LoginRequest: Codable, Sendable {

    let email: String
    let password: String
    let deviceId: String
    let deviceType: String

    enum CodingKeys: String, CodingKey {
        case email
        case password
        case deviceId = "device_id"
        case deviceType = "device_type"
    }

    /// Creates a login request with the device type automatically set to "ios".
    init(email: String, password: String, deviceId: String) {
        self.email = email
        self.password = password
        self.deviceId = deviceId
        self.deviceType = "ios"
    }
}

// MARK: - RegisterRequest

/// Request body for POST /auth/register.
struct RegisterRequest: Codable, Sendable {

    let email: String
    let password: String
    let name: String
    let tenantId: String
    let deviceId: String
    let deviceType: String

    enum CodingKeys: String, CodingKey {
        case email
        case password
        case name
        case tenantId = "tenant_id"
        case deviceId = "device_id"
        case deviceType = "device_type"
    }

    /// Creates a registration request with the device type automatically set to "ios".
    init(email: String, password: String, name: String, tenantId: String, deviceId: String) {
        self.email = email
        self.password = password
        self.name = name
        self.tenantId = tenantId
        self.deviceId = deviceId
        self.deviceType = "ios"
    }
}

// MARK: - LogoutRequest

/// Request body for POST /auth/logout.
struct LogoutRequest: Codable, Sendable {

    let deviceId: String

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
    }
}
