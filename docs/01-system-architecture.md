# Algo - System Architecture Document

## 1. Full System Architecture

### High-Level Architecture

```
                    +-----------------------+
                    |     MOBILE CLIENTS    |
                    |  iOS (Swift/SwiftUI)  |
                    | Android (Kotlin/JC)   |
                    +-----------+-----------+
                                |
                         HTTPS/WSS
                                |
                    +-----------v-----------+
                    |    API GATEWAY /       |
                    |    LOAD BALANCER       |
                    |  (AWS ALB / Nginx)     |
                    +-----------+-----------+
                                |
              +-----------------+-----------------+
              |                                   |
   +----------v----------+          +-------------v-----------+
   |   AUTH SERVICE       |          |   AI ORCHESTRATION      |
   |   (OAuth 2.0/JWT)   |          |   SERVER (Node.js)      |
   |   - Token issuance  |          |                         |
   |   - Token refresh   |          |   +------------------+  |
   |   - RBAC            |          |   | Intent Classifier |  |
   |   - MFA             |          |   +------------------+  |
   +---------------------+          |   | Action Mapper     |  |
                                    |   +------------------+  |
                                    |   | Response Generator|  |
                                    |   +------------------+  |
                                    |   | Context Memory    |  |
                                    |   +------------------+  |
                                    +-------------+-----------+
                                                  |
                                    +-------------v-----------+
                                    |   LLM PROVIDER          |
                                    |   (Claude API primary)  |
                                    |   (OpenAI fallback)     |
                                    +-------------------------+
                                                  |
                                    +-------------v-----------+
                                    |   ALGONIT API GATEWAY   |
                                    |   (Internal Middleware)  |
                                    +-------------+-----------+
                                                  |
                    +-----------------------------+-----------------------------+
                    |              |              |              |              |
              +-----v----+  +----v-----+  +-----v----+  +-----v----+  +------v-----+
              | Campaign |  | Social   |  | Lead/CRM |  | Email    |  | Analytics  |
              | Service  |  | Service  |  | Service  |  | Service  |  | Service    |
              +----------+  +----------+  +----------+  +----------+  +------------+

                                    +-------------------------+
                                    |   SUPPORTING SERVICES   |
                                    +-------------------------+
                                    | - Push Notification Svc |
                                    | - Alert Engine          |
                                    | - Conversation Logger   |
                                    | - Rate Limiter          |
                                    | - Audit Trail           |
                                    +-------------------------+

                                    +-------------------------+
                                    |   DATA STORES           |
                                    +-------------------------+
                                    | - PostgreSQL (primary)  |
                                    | - Redis (cache/session) |
                                    | - S3 (audio/media)     |
                                    | - Elasticsearch (logs)  |
                                    +-------------------------+
```

### Data Flow: Voice Query

```
User speaks → iOS/Android STT → Text
  → HTTPS POST /api/v1/chat
  → API Gateway (rate limit, auth check)
  → AI Orchestration Server
    → Intent Classification (LLM)
    → Action Mapping (resolve to Algonit APIs)
    → Execute API calls to Algonit backend
    → Response Generation (LLM summarization)
    → Store conversation context (Redis + PostgreSQL)
  → JSON response to mobile
  → Mobile renders text + TTS playback
```

### Data Flow: Proactive Alert

```
Alert Engine (cron/event-driven)
  → Polls Algonit APIs for threshold conditions
  → Detects: hot lead / campaign drop / budget alert
  → Generates natural language summary via LLM
  → Pushes via FCM (Android) / APNs (iOS)
  → User taps notification → Opens Algo app → Contextual view
```

---

## 2. Tech Stack Recommendations

### Mobile

| Layer | iOS | Android |
|-------|-----|---------|
| Language | Swift 5.9+ | Kotlin 2.0+ |
| UI Framework | SwiftUI | Jetpack Compose |
| Architecture | MVVM + Clean Architecture | MVVM + Clean Architecture |
| Networking | URLSession + async/await | Ktor Client / Retrofit |
| Speech-to-Text | Apple Speech Framework | Android SpeechRecognizer |
| Text-to-Speech | AVSpeechSynthesizer | Android TextToSpeech |
| Push | APNs | Firebase Cloud Messaging |
| Auth Storage | Keychain | EncryptedSharedPreferences |
| Local DB | SwiftData / CoreData | Room |
| DI | Swift DI / Factory | Hilt (Dagger) |
| WebSocket | URLSessionWebSocketTask | OkHttp WebSocket |

### Backend (AI Orchestration Server)

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 22 LTS (TypeScript) |
| Framework | Fastify (high performance) |
| LLM Primary | Claude API (claude-sonnet-4-6) |
| LLM Fallback | OpenAI GPT-4o |
| Queue | BullMQ (Redis-backed) |
| Cache | Redis 7 |
| Database | PostgreSQL 16 |
| Search/Logs | Elasticsearch 8 |
| Object Storage | AWS S3 |
| Push Notifications | Firebase Admin SDK + APNs |
| Auth | Custom OAuth 2.0 server (node-oidc-provider) |
| Rate Limiting | Redis + sliding window algorithm |
| Monitoring | Prometheus + Grafana |
| Logging | Pino + Elasticsearch |
| Containerization | Docker + Kubernetes (EKS) |
| CI/CD | GitHub Actions |
| CDN/Gateway | AWS CloudFront + ALB |

### Infrastructure

| Component | Service |
|-----------|---------|
| Cloud Provider | AWS (primary) |
| Container Orchestration | EKS (Kubernetes) |
| Database Hosting | RDS PostgreSQL (Multi-AZ) |
| Cache | ElastiCache Redis |
| Secrets | AWS Secrets Manager |
| DNS | Route 53 |
| SSL | ACM (Certificate Manager) |
| Monitoring | CloudWatch + Grafana |

---

## 3. Scalability Design for 10k Concurrent Users

### Compute Layer
- **AI Orchestration**: Auto-scaling Kubernetes pods (HPA)
  - Min: 4 pods, Max: 20 pods
  - Scale trigger: CPU > 60% or request latency > 500ms
  - Each pod handles ~500 concurrent connections

### Caching Strategy
- **Redis Cluster**: 3 nodes minimum
  - Session cache: TTL 30 minutes
  - Conversation context: TTL 24 hours
  - API response cache: TTL 5 minutes (for analytics)
  - Intent classification cache: TTL 1 hour (same queries)

### Database
- **PostgreSQL Multi-AZ**:
  - Primary + 2 read replicas
  - Connection pooling via PgBouncer (max 200 connections per node)
  - Partitioned conversation_logs table by month
  - Archived conversations older than 90 days to cold storage

### LLM Rate Management
- Request queue with BullMQ
- Priority queuing (action commands > queries > alerts)
- Circuit breaker pattern for LLM API failures
- Fallback to secondary LLM provider
- Token budget per tenant per hour

### WebSocket Connections
- Sticky sessions via ALB
- Redis Pub/Sub for cross-pod message routing
- Heartbeat every 30s, reconnect with exponential backoff

### Estimated Resource Requirements (10k concurrent)

| Resource | Specification |
|----------|--------------|
| API Pods | 8-12 pods (4 vCPU, 8GB RAM each) |
| Redis | 3-node cluster (r6g.large) |
| PostgreSQL | db.r6g.xlarge (primary) + 2 read replicas |
| LLM API | ~2000 RPM (requests per minute) |
| Bandwidth | ~500 Mbps sustained |
| Storage | ~500GB/month (conversations + audio) |
