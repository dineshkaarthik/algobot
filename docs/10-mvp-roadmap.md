# Algo - MVP Roadmap & Development Timeline

---

## Phase 1: Foundation (Weeks 1–6)
**Goal**: Working chat interface with basic query capabilities

### Week 1–2: Backend Core
- [ ] Project setup: Node.js + TypeScript + Fastify boilerplate
- [ ] PostgreSQL database setup with migrations
- [ ] Redis setup
- [ ] Authentication service (OAuth 2.0, JWT issuance/refresh)
- [ ] Multi-tenant middleware
- [ ] Rate limiting middleware
- [ ] Health check endpoint
- [ ] Docker Compose for local development
- [ ] CI/CD pipeline (GitHub Actions)

### Week 3–4: AI Orchestration Layer
- [ ] Claude API integration (primary LLM provider)
- [ ] Intent classification service
- [ ] Entity extraction service
- [ ] Response generation service
- [ ] Context memory (Redis-backed, multi-turn)
- [ ] Algonit API client (mock responses initially)
- [ ] Action mapper for query intents:
  - `query.social.performance`
  - `query.leads.count`
  - `query.credits.balance`
  - `query.campaign.status`
- [ ] Chat endpoint: `POST /chat/message`
- [ ] Conversation history endpoints

### Week 5–6: Mobile App v1 (iOS + Android in parallel)
- [ ] iOS: Project setup (SwiftUI + MVVM)
- [ ] Android: Project setup (Jetpack Compose + Hilt)
- [ ] Login screen with token-based auth
- [ ] Chat interface (text input only)
- [ ] Message bubbles (user + assistant)
- [ ] Suggested action buttons
- [ ] Basic dashboard screen (static metrics)
- [ ] Secure token storage (Keychain / EncryptedSharedPreferences)
- [ ] Navigation structure (tabs: Chat, Dashboard, Settings)

### Phase 1 Deliverable
- Users can log in and ask performance questions via text
- AI returns conversational responses with real Algonit data
- Multi-turn conversations supported
- Basic dashboard with key metrics

---

## Phase 2: Voice + Actions (Weeks 7–12)
**Goal**: Voice interaction, action execution with confirmations, push notifications

### Week 7–8: Voice Integration
- [ ] iOS: Speech-to-Text (Apple Speech Framework)
- [ ] Android: Speech-to-Text (SpeechRecognizer)
- [ ] Press-to-talk UI component with waveform animation
- [ ] Text-to-Speech response playback
- [ ] Audio upload endpoint (`POST /audio/upload`)
- [ ] Server-side STT fallback (Whisper API) for accuracy improvement
- [ ] Real-time transcription display

### Week 9–10: Action Execution
- [ ] Action mapper for write intents:
  - `action.campaign.create`
  - `action.campaign.pause` / `action.campaign.resume`
  - `action.content.generate`
  - `action.social.post`
  - `action.followup.trigger`
  - `action.task.assign`
  - `action.report.generate`
- [ ] Confirmation flow (backend + mobile UI)
- [ ] Pending actions table and expiry
- [ ] Action result display (success/failure cards)
- [ ] Algonit API integration (real endpoints, not mocks)

### Week 11–12: Push Notifications
- [ ] Firebase Cloud Messaging setup (Android)
- [ ] APNs setup (iOS)
- [ ] Device registration endpoint
- [ ] Alert engine (background worker)
  - Hot lead detection
  - Campaign performance drop
  - Budget threshold alerts
  - Credit exhaustion warnings
  - Overdue follow-up reminders
- [ ] Notification preferences (per-alert-type toggle)
- [ ] Notification list screen
- [ ] Deep linking from notifications to relevant screens
- [ ] WebSocket connection for real-time updates

### Phase 2 Deliverable
- Full voice + text interaction
- Users can execute actions through conversation
- Confirmation flow for destructive/important actions
- Proactive push notifications for alerts
- Real-time dashboard updates

---

## Phase 3: Polish & Scale (Weeks 13–18)
**Goal**: Production hardening, advanced features, enterprise readiness

### Week 13–14: Advanced AI Features
- [ ] Multi-intent handling (parse compound queries)
- [ ] Smarter context memory (pronoun resolution via LLM)
- [ ] Conversation summarization (auto-generate titles)
- [ ] Follow-up suggestions engine
- [ ] Response streaming (WebSocket chunked delivery)
- [ ] LLM fallback (OpenAI as secondary provider)
- [ ] Token usage tracking and per-tenant budgets
- [ ] Intent confidence monitoring and retraining signals

### Week 15–16: UI/UX Polish
- [ ] Executive dashboard redesign
  - Animated metric tiles
  - Mini charts (sparklines)
  - Alert severity badges
  - Pull-to-refresh
- [ ] Chat UI enhancements
  - Metric cards with charts
  - Typing indicator animation
  - Message status (sent, delivered, read)
  - Error retry
- [ ] Quick actions grid (1-tap common queries)
- [ ] Conversation search
- [ ] Dark mode support
- [ ] Accessibility audit (VoiceOver / TalkBack)
- [ ] Onboarding flow (first-time user tutorial)
- [ ] Biometric authentication (Face ID / Fingerprint)

### Week 17–18: Production Hardening
- [ ] Kubernetes deployment configs (EKS)
- [ ] Horizontal Pod Autoscaler (HPA)
- [ ] Load testing (k6/Artillery for 10k concurrent users)
- [ ] PostgreSQL read replicas + connection pooling
- [ ] Redis cluster configuration
- [ ] Monitoring stack (Prometheus + Grafana dashboards)
- [ ] Alerting (PagerDuty integration)
- [ ] Log aggregation (Elasticsearch + Kibana)
- [ ] Security audit
  - Penetration testing
  - Dependency vulnerability scan
  - Certificate pinning verification
  - Token rotation testing
- [ ] Audit log compliance review
- [ ] Data retention policy automation
- [ ] App Store / Play Store submission prep
  - Screenshots and preview videos
  - Privacy policy
  - App review guidelines compliance

### Phase 3 Deliverable
- Production-ready system handling 10k concurrent users
- Polished mobile UX
- Advanced AI with multi-intent and streaming
- Complete monitoring and alerting
- App Store / Play Store ready

---

## Team Structure (Recommended)

| Role | Count | Responsibility |
|------|-------|----------------|
| iOS Engineer | 1-2 | Swift/SwiftUI app |
| Android Engineer | 1-2 | Kotlin/Compose app |
| Backend Engineer | 2 | Node.js orchestration, API integration |
| AI/ML Engineer | 1 | Prompt engineering, intent tuning, LLM integration |
| DevOps Engineer | 1 | Infrastructure, CI/CD, monitoring |
| UI/UX Designer | 1 | Mobile design, design system |
| QA Engineer | 1 | Testing strategy, automation |
| Product Manager | 1 | Roadmap, prioritization |
| **Total** | **9-11** | |

---

## Cost Estimates (Monthly, Production)

| Category | Item | Est. Cost |
|----------|------|-----------|
| **Infrastructure** | EKS cluster (3 nodes) | $500-800 |
| | RDS PostgreSQL (Multi-AZ) | $300-500 |
| | ElastiCache Redis (3 nodes) | $200-400 |
| | S3 storage | $50-100 |
| | CloudFront CDN | $50-100 |
| | ALB | $50 |
| **AI/LLM** | Claude API (Sonnet, ~2M req/mo) | $2,000-5,000 |
| | OpenAI fallback | $500-1,000 |
| **Services** | Firebase (FCM) | Free tier |
| | APNs | $99/yr (Apple Dev) |
| | Elasticsearch | $300-500 |
| | Monitoring (Grafana Cloud) | $100-200 |
| **Total** | | **$4,000-8,500/mo** |

---

## Key Milestones

| Milestone | Target Date | Criteria |
|-----------|-------------|----------|
| Backend API functional | Week 4 | Chat endpoint returns LLM responses |
| Mobile alpha (internal) | Week 6 | Text chat working on both platforms |
| Voice integration | Week 8 | Speech-to-text working end-to-end |
| Action execution | Week 10 | Can pause/create campaigns via chat |
| Push notifications live | Week 12 | Proactive alerts delivered |
| Beta release (limited users) | Week 14 | 50-100 beta users |
| Load test passed (10k) | Week 17 | Sustained 10k concurrent, p99 < 500ms |
| App Store submission | Week 18 | Both platforms submitted |
| Public launch | Week 20 | General availability |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Algonit API instability/changes | Medium | High | Abstract behind client layer, version API contracts, mock fallbacks |
| LLM response quality issues | Medium | High | Prompt iteration, confidence thresholds, human-in-the-loop for critical actions |
| LLM cost overrun | Medium | Medium | Token budgets per tenant, caching frequent queries, use smaller model for classification |
| App Store rejection | Low | High | Early compliance review, follow HIG/Material guidelines |
| Security breach | Low | Critical | Defense in depth, regular audits, incident response plan |
| Scope creep | High | Medium | Strict phase gates, MVP-first mindset, weekly prioritization |
