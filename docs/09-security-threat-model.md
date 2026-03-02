# Algo - Security Threat Model

## STRIDE Analysis

---

## 1. Authentication & Authorization

### Threats

| # | Threat | Category | Severity | Mitigation |
|---|--------|----------|----------|------------|
| T1 | Brute force login | Spoofing | High | Rate limit: 5 attempts/min, account lockout after 10 failed attempts, progressive delay |
| T2 | JWT token theft | Spoofing | Critical | Short-lived tokens (1hr), refresh tokens with rotation, device binding, Keychain/EncryptedSharedPreferences storage |
| T3 | Refresh token replay | Spoofing | High | Single-use refresh tokens with rotation, token family tracking, revoke all on anomaly |
| T4 | Privilege escalation | Elevation | Critical | Server-side RBAC enforcement on every request, role embedded in JWT, re-verified against DB |
| T5 | Cross-tenant access | Elevation | Critical | Tenant ID in JWT, validated against every DB query, row-level security in PostgreSQL |

### Controls

```
Authentication Flow:
  1. User logs in with email + password
  2. Server validates credentials against bcrypt hash (cost factor 12)
  3. Issues JWT (RS256, 1hr TTL) + refresh token (opaque, 7d TTL)
  4. JWT contains: user_id, tenant_id, role, device_id, exp, iat, jti
  5. Refresh token stored server-side (Redis) with device binding
  6. Token refresh issues new access + refresh token (rotation)
  7. Old refresh token immediately invalidated
  8. If old refresh token is reused → revoke entire token family (compromise detection)

Authorization:
  - Role-based access control (RBAC)
  - Roles: admin, manager, member, viewer
  - Permissions matrix enforced at middleware level
  - Admin: full access
  - Manager: read all + write own team
  - Member: read/write own data
  - Viewer: read-only
```

### Permission Matrix

| Action | Admin | Manager | Member | Viewer |
|--------|-------|---------|--------|--------|
| View all campaigns | Y | Y | Own | Own |
| Create campaign | Y | Y | Y | N |
| Pause/resume campaign | Y | Y | Own | N |
| Delete campaign | Y | N | N | N |
| View all leads | Y | Y | Team | Own |
| Generate content | Y | Y | Y | N |
| Assign tasks | Y | Y | Team | N |
| View analytics | Y | Y | Y | Y |
| Manage users | Y | N | N | N |
| Manage billing | Y | N | N | N |

---

## 2. Data Protection

### Threats

| # | Threat | Category | Severity | Mitigation |
|---|--------|----------|----------|------------|
| T6 | Data in transit interception | Information Disclosure | High | TLS 1.3 everywhere, certificate pinning on mobile, HSTS |
| T7 | Data at rest exposure | Information Disclosure | High | AES-256 encryption for sensitive DB columns, encrypted backups |
| T8 | Conversation data leak | Information Disclosure | Critical | Tenant isolation at query level, no cross-tenant joins possible |
| T9 | Audio recording exposure | Information Disclosure | Medium | S3 server-side encryption (SSE-S3), presigned URLs with 5min TTL |
| T10 | Local device data theft | Information Disclosure | Medium | iOS Keychain / Android EncryptedSharedPreferences, no sensitive data in UserDefaults |

### Controls

```
Transport Security:
  - TLS 1.3 on all endpoints
  - Certificate pinning for mobile apps (backup pins included)
  - HSTS header with 1-year max-age
  - WebSocket connections over WSS only

Storage Security:
  - PostgreSQL: pgcrypto for sensitive columns
  - S3: SSE-S3 encryption, bucket policy blocks public access
  - Redis: AUTH enabled, TLS in transit
  - Mobile: Keychain (iOS) / EncryptedSharedPreferences (Android)
  - No sensitive data in app logs or crash reports

Tenant Isolation:
  - Every DB query includes tenant_id WHERE clause
  - PostgreSQL Row Level Security (RLS) as defense-in-depth
  - S3 object paths prefixed with tenant_id
  - Redis keys prefixed with tenant_id
  - API responses filtered by tenant before serialization
```

---

## 3. API Security

### Threats

| # | Threat | Category | Severity | Mitigation |
|---|--------|----------|----------|------------|
| T11 | API abuse / DDoS | Denial of Service | High | Rate limiting (sliding window), WAF, CloudFront DDoS protection |
| T12 | Injection via chat input | Tampering | Critical | Input sanitization, parameterized queries, LLM prompt injection defense |
| T13 | SSRF via Algonit API proxy | Tampering | High | Whitelist allowed Algonit endpoints, no user-controlled URLs in backend requests |
| T14 | Mass assignment | Tampering | Medium | Strict Zod schema validation on all inputs, explicit field whitelisting |
| T15 | Insecure direct object reference | Information Disclosure | High | Always verify resource ownership (tenant_id + user role) before returning data |

### Controls

```
Rate Limiting (per user per tenant):
  /auth/login:          5 req/min
  /chat/message:       30 req/min
  /dashboard/*:        60 req/min
  /audio/upload:       10 req/min
  WebSocket messages:  20 req/min
  Global per IP:      300 req/min

Input Validation:
  - All request bodies validated via Zod schemas
  - Max message length: 2,000 characters
  - Max audio duration: 60 seconds
  - File upload: only m4a/wav, max 5MB
  - No HTML/script tags in text inputs
  - SQL injection: parameterized queries via query builder (Knex/Drizzle)

LLM Prompt Injection Defense:
  - User input is ALWAYS passed as a variable, never interpolated into system prompts
  - System prompts are read-only, stored server-side
  - Output from LLM is parsed as JSON, never executed
  - Intent classification confidence threshold: reject < 0.5
  - Action execution requires explicit user confirmation
  - LLM responses are sanitized before returning to client
```

---

## 4. LLM-Specific Threats

| # | Threat | Category | Severity | Mitigation |
|---|--------|----------|----------|------------|
| T16 | Prompt injection via user message | Tampering | Critical | Strict input/output boundary, user content in dedicated message role, output parsing only |
| T17 | Data exfiltration via LLM | Information Disclosure | High | LLM sees only data from user's tenant, no cross-tenant data in context |
| T18 | LLM hallucination leading to wrong action | Integrity | High | Confirmation required for all write actions, structured output validation |
| T19 | Token budget exhaustion | Denial of Service | Medium | Per-tenant token budget per hour, circuit breaker on LLM API |
| T20 | LLM provider outage | Availability | Medium | Fallback to secondary provider, graceful degradation |

### LLM Security Architecture

```
User Input → [Sanitization] → [Intent Classification (LLM call 1)]
  → [Structured JSON parsing + validation]
  → [API calls to Algonit with user's permissions]
  → [Response Generation (LLM call 2) with API data]
  → [Output sanitization]
  → User Response

Key principles:
  1. User input is NEVER concatenated into system prompts
  2. LLM output is ALWAYS parsed as structured data
  3. No LLM output is ever eval()'d or executed as code
  4. All actions derived from LLM classification are verified against RBAC
  5. Write actions ALWAYS require explicit user confirmation
  6. LLM context window contains only current tenant's data
```

---

## 5. Infrastructure Security

| # | Threat | Category | Severity | Mitigation |
|---|--------|----------|----------|------------|
| T21 | Container escape | Elevation | Critical | Non-root containers, read-only filesystem, SecurityContext in k8s |
| T22 | Secret exposure | Information Disclosure | Critical | AWS Secrets Manager, never in env files or code, rotated quarterly |
| T23 | Dependency vulnerability | Tampering | High | Automated dependency scanning (Snyk/Dependabot), weekly updates |
| T24 | Unauthorized cluster access | Spoofing | Critical | RBAC in EKS, IAM roles for service accounts, no public API server |
| T25 | Log data exposure | Information Disclosure | Medium | PII redacted from logs, log access restricted, retention policy |

---

## 6. Mobile App Security

| # | Threat | Category | Severity | Mitigation |
|---|--------|----------|----------|------------|
| T26 | Reverse engineering | Information Disclosure | Medium | ProGuard/R8 (Android), Swift compiler optimization, no secrets in app binary |
| T27 | Man-in-the-middle | Information Disclosure | High | Certificate pinning, TLS 1.3, reject invalid certificates |
| T28 | Jailbreak/root detection | Tampering | Low | Detect jailbroken/rooted devices, warn user, restrict sensitive operations |
| T29 | Screenshot/screen recording | Information Disclosure | Low | Blur sensitive data in app switcher (iOS), FLAG_SECURE (Android) |
| T30 | Biometric bypass | Spoofing | Medium | Biometric + device passcode fallback, re-authenticate for sensitive actions |

---

## 7. Audit & Compliance

### Logging Requirements

```
Every API request logs:
  - request_id (UUID, for tracing)
  - tenant_id
  - user_id
  - action (endpoint + method)
  - IP address
  - user agent
  - timestamp
  - response status code
  - response time

High-value actions additionally log:
  - Resource type and ID
  - Before/after state (for mutations)
  - Confirmation details

Logs are:
  - Written to Elasticsearch for search/analysis
  - Retained for 1 year
  - Immutable (append-only index)
  - PII fields redacted (email → e***@domain.com)
```

### Compliance Considerations

- **GDPR**: Right to erasure (conversation deletion), data export, consent tracking
- **SOC 2**: Audit trail, access controls, encryption at rest and in transit
- **CCPA**: Data disclosure, opt-out mechanisms
- **HIPAA**: Not applicable (no health data), but encryption standards aligned

---

## 8. Incident Response Plan

```
Severity Levels:
  P1 (Critical): Data breach, unauthorized access, service-wide outage
  P2 (High):     Single-tenant compromise, partial outage, LLM manipulation
  P3 (Medium):   Rate limit breach, failed auth spike, performance degradation
  P4 (Low):      Single user issue, minor bug, cosmetic issue

Response Timeline:
  P1: Acknowledge in 15 min, mitigate in 1 hour, RCA in 24 hours
  P2: Acknowledge in 1 hour, mitigate in 4 hours, RCA in 48 hours
  P3: Acknowledge in 4 hours, resolve in 24 hours
  P4: Acknowledge in 24 hours, resolve in 1 week

Key Contacts:
  - Security Lead: [TBD]
  - On-call Engineer: PagerDuty rotation
  - Legal: [TBD] (for breach notification)
```
