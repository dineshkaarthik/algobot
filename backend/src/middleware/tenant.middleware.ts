import type { FastifyRequest, FastifyReply } from 'fastify';

export async function tenantMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Tenant ID is set by auth middleware from JWT
  if (!request.tenantId) {
    return reply.status(403).send({
      error: { code: 'NO_TENANT', message: 'Tenant context not established' },
    });
  }

  // Validate tenant header matches JWT if provided
  const headerTenantId = request.headers['x-tenant-id'];
  if (headerTenantId && headerTenantId !== request.tenantId) {
    return reply.status(403).send({
      error: { code: 'TENANT_MISMATCH', message: 'Tenant ID mismatch' },
    });
  }
}
