// User.swift
// Algo
//
// User model representing an authenticated Algonit platform user.

import Foundation

// MARK: - User

struct User: Codable, Identifiable, Sendable, Equatable {

    let id: String
    let email: String
    let name: String
    let role: UserRole
    let tenantId: String
    let avatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case role
        case tenantId = "tenant_id"
        case avatarUrl = "avatar_url"
    }
}

// MARK: - UserRole

enum UserRole: String, Codable, Sendable, CaseIterable {
    case admin
    case manager
    case member
    case viewer

    var displayName: String {
        switch self {
        case .admin: "Admin"
        case .manager: "Manager"
        case .member: "Member"
        case .viewer: "Viewer"
        }
    }

    /// Whether this role can perform write/action operations.
    var canPerformActions: Bool {
        switch self {
        case .admin, .manager: true
        case .member, .viewer: false
        }
    }
}
