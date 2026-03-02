import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  inet,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ─── Tenants ─────────────────────────────────────────────
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  algonitOrgId: varchar('algonit_org_id', { length: 255 }).notNull().unique(),
  plan: varchar('plan', { length: 50 }).notNull().default('basic'),
  settings: jsonb('settings').default({}),
  alertThresholds: jsonb('alert_thresholds').default({
    budget_threshold_pct: 80,
    credit_threshold: 500,
    campaign_drop_pct: 20,
  }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Users ───────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('member'),
    avatarUrl: text('avatar_url'),
    algonitUserId: varchar('algonit_user_id', { length: 255 }),
    isActive: boolean('is_active').default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_users_tenant_email').on(table.tenantId, table.email),
    index('idx_users_tenant').on(table.tenantId),
  ],
);

// ─── Conversations ───────────────────────────────────────
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    title: varchar('title', { length: 500 }),
    status: varchar('status', { length: 20 }).default('active'),
    messageCount: integer('message_count').default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_conversations_user').on(table.userId),
    index('idx_conversations_tenant').on(table.tenantId),
    index('idx_conversations_updated').on(table.updatedAt),
  ],
);

// ─── Messages ────────────────────────────────────────────
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    role: varchar('role', { length: 20 }).notNull(), // user | assistant | system
    content: text('content').notNull(),
    inputType: varchar('input_type', { length: 20 }), // text | voice

    // AI classification
    intent: jsonb('intent'),
    entities: jsonb('entities'),
    structuredData: jsonb('structured_data'),
    suggestedActions: jsonb('suggested_actions'),

    // Agentic reasoning trace
    reasoningTrace: jsonb('reasoning_trace'), // Full agent thought process
    toolCalls: jsonb('tool_calls'), // Tools the agent invoked
    planSteps: jsonb('plan_steps'), // Multi-step plan if applicable

    // Action tracking
    requiresConfirmation: boolean('requires_confirmation').default(false),
    confirmationId: varchar('confirmation_id', { length: 255 }),
    actionStatus: varchar('action_status', { length: 20 }),

    // Token tracking
    llmProvider: varchar('llm_provider', { length: 20 }),
    llmModel: varchar('llm_model', { length: 50 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_messages_conversation').on(table.conversationId, table.createdAt),
    index('idx_messages_tenant').on(table.tenantId, table.createdAt),
  ],
);

// ─── Devices (Push Notifications) ────────────────────────
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    deviceId: varchar('device_id', { length: 255 }).notNull(),
    deviceType: varchar('device_type', { length: 20 }).notNull(),
    pushToken: text('push_token'),
    appVersion: varchar('app_version', { length: 20 }),
    osVersion: varchar('os_version', { length: 50 }),
    isActive: boolean('is_active').default(true),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_devices_user_device').on(table.userId, table.deviceId),
    index('idx_devices_user').on(table.userId),
  ],
);

// ─── Notifications ───────────────────────────────────────
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    body: text('body').notNull(),
    severity: varchar('severity', { length: 20 }).default('medium'),
    data: jsonb('data').default({}),
    actionUrl: text('action_url'),
    isRead: boolean('is_read').default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    pushSent: boolean('push_sent').default(false),
    pushSentAt: timestamp('push_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_notifications_user_unread').on(table.userId, table.isRead, table.createdAt),
    index('idx_notifications_tenant').on(table.tenantId, table.createdAt),
  ],
);

// ─── Pending Actions (Confirmation Queue) ────────────────
export const pendingActions = pgTable(
  'pending_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    messageId: uuid('message_id').notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    confirmationId: varchar('confirmation_id', { length: 255 }).notNull().unique(),
    intent: varchar('intent', { length: 100 }).notNull(),
    actionType: varchar('action_type', { length: 50 }).notNull(),
    targetResource: jsonb('target_resource').notNull(),
    apiCall: jsonb('api_call').notNull(),
    status: varchar('status', { length: 20 }).default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_pending_confirmation').on(table.confirmationId),
    index('idx_pending_status').on(table.status, table.expiresAt),
  ],
);

// ─── Audit Logs ──────────────────────────────────────────
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id'),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceId: varchar('resource_id', { length: 255 }),
    details: jsonb('details').default({}),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    requestId: varchar('request_id', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_audit_tenant_time').on(table.tenantId, table.createdAt),
    index('idx_audit_user').on(table.userId, table.createdAt),
  ],
);

// ─── Refresh Tokens ──────────────────────────────────────
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    familyId: varchar('family_id', { length: 255 }).notNull(), // For rotation detection
    deviceId: varchar('device_id', { length: 255 }),
    isRevoked: boolean('is_revoked').default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_refresh_user').on(table.userId),
    index('idx_refresh_family').on(table.familyId),
  ],
);

// ─── Algonit Connections (API tokens) ───────────────────
export const algonitConnections = pgTable(
  'algonit_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id)
      .unique(),
    algonitOrgId: varchar('algonit_org_id', { length: 255 }),
    accessTokenEnc: text('access_token_enc').notNull(), // AES-256-GCM encrypted API token
    status: varchar('status', { length: 20 }).default('active'), // active | revoked
    connectedBy: uuid('connected_by').references(() => users.id),
    connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_algonit_conn_tenant').on(table.tenantId),
    index('idx_algonit_conn_status').on(table.status),
  ],
);

// ─── KPI Snapshots (Growth Copilot) ─────────────────────
export const kpiSnapshots = pgTable(
  'kpi_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    metrics: jsonb('metrics').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_kpi_snapshots_tenant_time').on(table.tenantId, table.capturedAt),
  ],
);

// ─── Recommendations (Growth Copilot) ───────────────────
export const recommendations = pgTable(
  'recommendations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description').notNull(),
    confidence: real('confidence').notNull(),
    impact: varchar('impact', { length: 20 }).notNull(),
    category: varchar('category', { length: 20 }).notNull(),
    actionable: boolean('actionable').default(false),
    action: jsonb('action'),
    dataPoints: jsonb('data_points'),
    status: varchar('status', { length: 20 }).default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_recs_tenant_status').on(table.tenantId, table.status, table.createdAt),
    index('idx_recs_tenant_created').on(table.tenantId, table.createdAt),
  ],
);

// ─── Execution Log (Growth Copilot) ─────────────────────
export const executionLog = pgTable(
  'execution_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    recommendationId: uuid('recommendation_id').references(() => recommendations.id),
    userId: uuid('user_id').references(() => users.id),
    actionType: varchar('action_type', { length: 50 }).notNull(),
    beforeState: jsonb('before_state').notNull(),
    afterState: jsonb('after_state').notNull(),
    result: varchar('result', { length: 20 }).notNull(),
    error: text('error'),
    executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_exec_log_tenant').on(table.tenantId, table.executedAt),
  ],
);

// ─── Vertical Configs (Growth Copilot — Phase 2) ────────
export const verticalConfigs = pgTable(
  'vertical_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vertical: varchar('vertical', { length: 50 }).notNull().unique(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    kpiWeights: jsonb('kpi_weights').notNull(),
    alertThresholds: jsonb('alert_thresholds').notNull(),
    recommendationRules: jsonb('recommendation_rules').notNull(),
    benchmarks: jsonb('benchmarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
);

// ─── Webhook Events ─────────────────────────────────────
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    payload: jsonb('payload').notNull(),
    signature: varchar('signature', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).default('received'), // received | processed | failed
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_webhook_events_tenant').on(table.tenantId, table.createdAt),
    index('idx_webhook_events_status').on(table.status),
  ],
);
