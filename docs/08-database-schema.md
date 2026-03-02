# Algo - Database Schema

## PostgreSQL 16

---

## Entity Relationship Diagram

```
users ─────────────── tenants
  │                      │
  ├── conversations ─────┤
  │       │              │
  │       └── messages   │
  │                      │
  ├── devices            │
  │                      │
  ├── notifications ─────┤
  │                      │
  └── audit_logs ────────┘
```

---

## Tables

### 1. tenants

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    algonit_org_id  VARCHAR(255) NOT NULL UNIQUE,   -- Maps to Algonit organization
    plan            VARCHAR(50) NOT NULL DEFAULT 'basic',
    settings        JSONB DEFAULT '{}',
    alert_thresholds JSONB DEFAULT '{
        "budget_threshold_pct": 80,
        "credit_threshold": 500,
        "campaign_drop_pct": 20
    }',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenants_algonit_org ON tenants(algonit_org_id);
```

### 2. users

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'member',  -- admin, manager, member, viewer
    avatar_url      TEXT,
    algonit_user_id VARCHAR(255),                           -- Maps to Algonit user
    is_active       BOOLEAN DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
```

### 3. conversations

```sql
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    title           VARCHAR(500),                           -- Auto-generated from first message
    status          VARCHAR(20) DEFAULT 'active',           -- active, archived
    message_count   INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',                     -- Additional context
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
```

### 4. messages (partitioned by month)

```sql
CREATE TABLE messages (
    id              UUID DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    role            VARCHAR(20) NOT NULL,                   -- 'user' | 'assistant' | 'system'
    content         TEXT NOT NULL,                          -- Message text
    input_type      VARCHAR(20),                            -- 'text' | 'voice'
    audio_url       TEXT,                                   -- S3 URL for voice messages

    -- AI classification data
    intent          JSONB,                                  -- { category, domain, action, confidence }
    entities        JSONB,                                  -- Extracted entities
    structured_data JSONB,                                  -- Charts, metrics, etc.
    suggested_actions JSONB,                                -- Suggested follow-up actions

    -- Action tracking
    requires_confirmation BOOLEAN DEFAULT false,
    confirmation_id VARCHAR(255),
    action_status   VARCHAR(20),                            -- pending, confirmed, cancelled, executed

    -- Token usage tracking
    llm_provider    VARCHAR(20),                            -- claude, openai
    llm_model       VARCHAR(50),
    input_tokens    INTEGER,
    output_tokens   INTEGER,

    created_at      TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (automated via pg_partman or cron)
CREATE TABLE messages_2026_03 PARTITION OF messages
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE messages_2026_04 PARTITION OF messages
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_tenant ON messages(tenant_id, created_at DESC);
CREATE INDEX idx_messages_intent ON messages USING GIN (intent);
```

### 5. devices

```sql
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    device_id       VARCHAR(255) NOT NULL,                  -- Client-generated device ID
    device_type     VARCHAR(20) NOT NULL,                   -- 'ios' | 'android'
    push_token      TEXT,                                   -- APNs or FCM token
    app_version     VARCHAR(20),
    os_version      VARCHAR(50),
    is_active       BOOLEAN DEFAULT true,
    last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, device_id)
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_push_token ON devices(push_token);
```

### 6. notifications

```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    type            VARCHAR(50) NOT NULL,                   -- hot_lead, campaign_drop, etc.
    title           VARCHAR(500) NOT NULL,
    body            TEXT NOT NULL,
    severity        VARCHAR(20) DEFAULT 'medium',           -- high, medium, low
    data            JSONB DEFAULT '{}',                     -- Associated data payload
    action_url      TEXT,                                   -- Deep link path
    is_read         BOOLEAN DEFAULT false,
    read_at         TIMESTAMPTZ,
    push_sent       BOOLEAN DEFAULT false,
    push_sent_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type, created_at DESC);
```

### 7. notification_preferences

```sql
CREATE TABLE notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    alert_type      VARCHAR(50) NOT NULL,                   -- hot_lead, campaign_drop, etc.
    push_enabled    BOOLEAN DEFAULT true,
    email_enabled   BOOLEAN DEFAULT false,
    threshold_value NUMERIC,                                -- Custom threshold (e.g., budget %)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, alert_type)
);
```

### 8. audit_logs

```sql
CREATE TABLE audit_logs (
    id              UUID DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    user_id         UUID,
    action          VARCHAR(100) NOT NULL,                  -- login, chat_message, campaign_pause, etc.
    resource_type   VARCHAR(50),                            -- conversation, campaign, lead, etc.
    resource_id     VARCHAR(255),
    details         JSONB DEFAULT '{}',                     -- Action-specific details
    ip_address      INET,
    user_agent      TEXT,
    request_id      UUID,                                   -- For request tracing
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
```

### 9. pending_actions

```sql
CREATE TABLE pending_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES conversations(id),
    message_id          UUID NOT NULL,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    user_id             UUID NOT NULL REFERENCES users(id),
    confirmation_id     VARCHAR(255) NOT NULL UNIQUE,
    intent              VARCHAR(100) NOT NULL,
    action_type         VARCHAR(50) NOT NULL,               -- pause, create, delete, etc.
    target_resource     JSONB NOT NULL,                     -- The resource to act on
    api_call            JSONB NOT NULL,                     -- The API call to execute
    status              VARCHAR(20) DEFAULT 'pending',      -- pending, confirmed, cancelled, expired
    expires_at          TIMESTAMPTZ NOT NULL,               -- Auto-expire after 5 minutes
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_confirmation ON pending_actions(confirmation_id);
CREATE INDEX idx_pending_status ON pending_actions(status, expires_at);
```

---

## Redis Key Patterns

```
# Conversation context (TTL: 24h)
ctx:{tenant_id}:{conversation_id} → JSON

# Session data (TTL: 30min)
session:{user_id}:{device_id} → JSON

# Rate limiting (TTL: 60s)
rl:{tenant_id}:{user_id}:{endpoint} → counter

# API response cache (TTL: 5min)
cache:{tenant_id}:{api_endpoint_hash} → JSON

# WebSocket connection tracking
ws:{user_id} → Set<pod_id>

# Alert deduplication (TTL: 1h)
alert_cooldown:{tenant_id}:{alert_type} → timestamp

# Refresh token blacklist (TTL: 7d)
revoked_token:{token_hash} → 1
```

---

## Migration Strategy

- Use **node-pg-migrate** or **Knex.js** for migrations
- Partitions auto-created monthly via a scheduled worker
- Retention policy: archive messages older than 90 days to S3 (Parquet format)
- Vacuum and analyze scheduled nightly via pg_cron

---

## Estimated Storage (10k users, 6 months)

| Table | Est. Rows | Est. Size |
|-------|-----------|-----------|
| messages | ~50M | ~25 GB |
| audit_logs | ~100M | ~40 GB |
| conversations | ~500K | ~500 MB |
| notifications | ~5M | ~2 GB |
| users | ~10K | ~10 MB |
| Total | | ~70 GB |
