/**
 * ════════════════════════════════════════════════════════════
 *  RBAC PERMISSION ENFORCEMENT
 * ════════════════════════════════════════════════════════════
 *
 *  Role-based access control middleware that enforces
 *  permission checks on every protected endpoint.
 *
 *  Roles: admin > manager > member > viewer
 *
 *  Usage:
 *    app.get('/campaigns', { preHandler: rbac('member') }, handler)
 *    app.delete('/campaigns/:id', { preHandler: rbac('admin') }, handler)
 * ════════════════════════════════════════════════════════════
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

type Role = 'admin' | 'manager' | 'member' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
};

/**
 * Permission definitions: which roles can perform which actions
 */
const PERMISSIONS: Record<string, Role> = {
  // Campaign actions
  'campaign:read': 'viewer',
  'campaign:create': 'member',
  'campaign:update': 'member',
  'campaign:pause': 'member',
  'campaign:resume': 'member',
  'campaign:delete': 'admin',

  // Lead actions
  'lead:read': 'viewer',
  'lead:update': 'member',
  'lead:assign': 'manager',
  'lead:delete': 'admin',

  // Content actions
  'content:read': 'viewer',
  'content:generate': 'member',
  'content:publish': 'member',

  // Task actions
  'task:read': 'viewer',
  'task:create': 'member',
  'task:assign': 'manager',

  // Report actions
  'report:read': 'viewer',
  'report:generate': 'member',

  // Analytics
  'analytics:read': 'viewer',
  'analytics:export': 'manager',

  // User/tenant management
  'user:read': 'manager',
  'user:create': 'admin',
  'user:update': 'admin',
  'user:delete': 'admin',
  'tenant:manage': 'admin',

  // Billing
  'billing:read': 'admin',
  'billing:manage': 'admin',

  // Notifications
  'notification:read': 'viewer',
  'notification:settings': 'member',
};

/**
 * Create RBAC middleware that checks minimum role level
 *
 * @param minRole - Minimum role required to access the endpoint
 */
export function rbac(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.userRole as Role;

    if (!userRole) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'No role assigned' },
      });
    }

    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return reply.status(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `This action requires ${minRole} role or higher. Your role: ${userRole}.`,
        },
      });
    }
  };
}

/**
 * Check if a user has a specific permission
 *
 * @param permission - Permission string like 'campaign:delete'
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.userRole as Role;
    const requiredRole = PERMISSIONS[permission];

    if (!requiredRole) {
      // Unknown permission — deny by default
      return reply.status(403).send({
        error: { code: 'UNKNOWN_PERMISSION', message: `Unknown permission: ${permission}` },
      });
    }

    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      return reply.status(403).send({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission '${permission}' requires ${requiredRole} role or higher.`,
        },
      });
    }
  };
}

/**
 * Check if user can access a specific resource (ownership check)
 * Admins and managers can access all; members/viewers only their own
 */
export function ownershipCheck(resourceUserIdField: string = 'userId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.userRole as Role;

    // Admins and managers can access everything
    if (userRole === 'admin' || userRole === 'manager') return;

    // Members and viewers can only access their own resources
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, string> | undefined;
    const resourceUserId = params[resourceUserIdField] || body?.[resourceUserIdField];

    if (resourceUserId && resourceUserId !== request.userId) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only access your own resources.',
        },
      });
    }
  };
}
