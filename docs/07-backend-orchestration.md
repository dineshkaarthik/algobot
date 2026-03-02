# Algo - Backend Orchestration Layer

## Runtime: Node.js 22 LTS + TypeScript + Fastify

---

## Directory Structure

```
algo-server/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   └── configmap.yaml
│
├── src/
│   ├── index.ts                           # Server entry point
│   ├── config/
│   │   ├── env.ts                         # Environment config
│   │   ├── database.ts                    # PostgreSQL config
│   │   ├── redis.ts                       # Redis config
│   │   └── llm.ts                         # LLM provider config
│   │
│   ├── routes/
│   │   ├── auth.routes.ts                 # /auth/*
│   │   ├── chat.routes.ts                 # /chat/*
│   │   ├── dashboard.routes.ts            # /dashboard/*
│   │   ├── notifications.routes.ts        # /notifications/*
│   │   ├── devices.routes.ts              # /devices/*
│   │   ├── audio.routes.ts                # /audio/*
│   │   └── health.routes.ts               # /health
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts             # JWT verification
│   │   ├── rateLimit.middleware.ts        # Rate limiting
│   │   ├── tenant.middleware.ts           # Multi-tenant isolation
│   │   ├── audit.middleware.ts            # Audit logging
│   │   ├── validation.middleware.ts       # Request validation
│   │   └── error.middleware.ts            # Global error handler
│   │
│   ├── services/
│   │   ├── auth/
│   │   │   ├── auth.service.ts            # Authentication logic
│   │   │   ├── jwt.service.ts             # Token generation/verification
│   │   │   └── oauth.service.ts           # OAuth 2.0 flow
│   │   │
│   │   ├── ai/
│   │   │   ├── orchestrator.ts            # Main AI orchestration pipeline
│   │   │   ├── intentClassifier.ts        # Intent classification via LLM
│   │   │   ├── entityExtractor.ts         # Entity extraction
│   │   │   ├── actionMapper.ts            # Map intents to API calls
│   │   │   ├── responseGenerator.ts       # Generate conversational response
│   │   │   ├── contextMemory.ts           # Multi-turn context management
│   │   │   └── promptTemplates.ts         # LLM prompt templates
│   │   │
│   │   ├── llm/
│   │   │   ├── llmProvider.ts             # Abstract LLM interface
│   │   │   ├── claudeProvider.ts          # Claude API integration
│   │   │   ├── openaiProvider.ts          # OpenAI fallback
│   │   │   └── llmRouter.ts              # Provider selection + fallback
│   │   │
│   │   ├── algonit/
│   │   │   ├── algonitClient.ts           # HTTP client for Algonit APIs
│   │   │   ├── campaigns.api.ts           # /campaigns proxy
│   │   │   ├── social.api.ts              # /social/* proxy
│   │   │   ├── leads.api.ts               # /leads proxy
│   │   │   ├── crm.api.ts                 # /crm proxy
│   │   │   ├── email.api.ts               # /email proxy
│   │   │   ├── credits.api.ts             # /credits proxy
│   │   │   └── analytics.api.ts           # /analytics proxy
│   │   │
│   │   ├── notifications/
│   │   │   ├── push.service.ts            # FCM + APNs push sending
│   │   │   ├── alert.engine.ts            # Proactive alert detection
│   │   │   └── notification.service.ts    # Notification CRUD
│   │   │
│   │   ├── conversation/
│   │   │   ├── conversation.service.ts    # Conversation CRUD
│   │   │   └── message.service.ts         # Message storage
│   │   │
│   │   └── websocket/
│   │       ├── wsServer.ts                # WebSocket server
│   │       └── wsHandlers.ts              # Event handlers
│   │
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── conversation.model.ts
│   │   ├── message.model.ts
│   │   ├── notification.model.ts
│   │   ├── device.model.ts
│   │   ├── auditLog.model.ts
│   │   └── intent.model.ts
│   │
│   ├── schemas/
│   │   ├── auth.schema.ts                 # Zod validation schemas
│   │   ├── chat.schema.ts
│   │   ├── notification.schema.ts
│   │   └── common.schema.ts
│   │
│   ├── workers/
│   │   ├── alert.worker.ts                # Background alert checking
│   │   ├── cleanup.worker.ts              # Old conversation cleanup
│   │   └── analytics.worker.ts            # Usage analytics aggregation
│   │
│   ├── types/
│   │   ├── intent.types.ts
│   │   ├── api.types.ts
│   │   ├── chat.types.ts
│   │   └── algonit.types.ts
│   │
│   └── utils/
│       ├── logger.ts                      # Pino logger
│       ├── crypto.ts                      # Encryption utilities
│       ├── dateUtils.ts                   # Date parsing
│       └── retry.ts                       # Retry with backoff
│
├── migrations/
│   ├── 001_create_users.ts
│   ├── 002_create_conversations.ts
│   ├── 003_create_messages.ts
│   ├── 004_create_notifications.ts
│   ├── 005_create_devices.ts
│   └── 006_create_audit_logs.ts
│
└── tests/
    ├── unit/
    │   ├── intentClassifier.test.ts
    │   ├── actionMapper.test.ts
    │   ├── contextMemory.test.ts
    │   └── responseGenerator.test.ts
    ├── integration/
    │   ├── chat.routes.test.ts
    │   ├── auth.routes.test.ts
    │   └── algonit.api.test.ts
    └── fixtures/
        ├── intents.json
        └── apiResponses.json
```

---

## Core Files Implementation

### src/services/ai/orchestrator.ts

```typescript
import { IntentClassifier } from './intentClassifier';
import { EntityExtractor } from './entityExtractor';
import { ActionMapper } from './actionMapper';
import { ResponseGenerator } from './responseGenerator';
import { ContextMemory } from './contextMemory';
import { LLMRouter } from '../llm/llmRouter';
import type { ChatRequest, ChatResponse, UserContext } from '../../types/chat.types';

export class AIOrchestrator {
  constructor(
    private intentClassifier: IntentClassifier,
    private entityExtractor: EntityExtractor,
    private actionMapper: ActionMapper,
    private responseGenerator: ResponseGenerator,
    private contextMemory: ContextMemory,
    private llmRouter: LLMRouter,
  ) {}

  async processMessage(request: ChatRequest, userContext: UserContext): Promise<ChatResponse> {
    // 1. Load conversation context
    const context = await this.contextMemory.getContext(
      request.conversation_id,
      userContext.tenant_id,
    );

    // 2. Resolve pronouns and references using context
    const resolvedMessage = await this.contextMemory.resolveReferences(
      request.message,
      context,
    );

    // 3. Classify intent
    const intent = await this.intentClassifier.classify(resolvedMessage, context);

    // 4. Extract entities
    const entities = await this.entityExtractor.extract(resolvedMessage, intent);

    // 5. Map intent to Algonit API calls
    const apiActions = await this.actionMapper.map(intent, entities, userContext);

    // 6. Execute API calls (or prepare confirmation)
    let apiResults;
    if (intent.requires_confirmation && !request.confirmation_id) {
      // Generate confirmation prompt instead of executing
      apiResults = await this.actionMapper.prepareConfirmation(apiActions, userContext);
    } else {
      // Execute the mapped API calls
      apiResults = await this.actionMapper.execute(apiActions, userContext);
    }

    // 7. Generate conversational response
    const response = await this.responseGenerator.generate({
      userQuery: request.message,
      intent,
      entities,
      apiResults,
      context,
      requiresConfirmation: intent.requires_confirmation && !request.confirmation_id,
    });

    // 8. Update conversation context
    await this.contextMemory.updateContext(request.conversation_id, {
      userMessage: request.message,
      assistantResponse: response.text,
      intent,
      entities,
      timestamp: new Date(),
    });

    return response;
  }
}
```

### src/services/ai/intentClassifier.ts

```typescript
import { LLMRouter } from '../llm/llmRouter';
import { INTENT_CLASSIFICATION_PROMPT } from './promptTemplates';
import type { ClassifiedIntent, ConversationContext } from '../../types/intent.types';

export class IntentClassifier {
  constructor(private llm: LLMRouter) {}

  async classify(message: string, context: ConversationContext): Promise<ClassifiedIntent> {
    const prompt = INTENT_CLASSIFICATION_PROMPT
      .replace('{USER_MESSAGE}', message)
      .replace('{CONVERSATION_CONTEXT}', JSON.stringify(context.recentTurns));

    const result = await this.llm.complete({
      prompt,
      maxTokens: 500,
      temperature: 0.1,  // Low temperature for consistent classification
      responseFormat: 'json',
    });

    const parsed = JSON.parse(result.content);

    return {
      category: parsed.intent.category,
      domain: parsed.intent.domain,
      action: parsed.intent.action,
      fullIntent: parsed.intent.full_intent,
      confidence: parsed.intent.confidence,
      entities: parsed.entities,
      requiresConfirmation: parsed.requires_confirmation,
    };
  }
}
```

### src/services/ai/actionMapper.ts

```typescript
import { AlgonitClient } from '../algonit/algonitClient';
import type { ClassifiedIntent, ExtractedEntities } from '../../types/intent.types';
import type { UserContext } from '../../types/chat.types';

// Maps intents to Algonit API calls
const INTENT_API_MAP: Record<string, ApiMapping> = {
  'query.social.performance': {
    method: 'GET',
    endpoint: '/social/performance',
    paramBuilder: (entities) => ({
      date_from: entities.time_range?.resolved?.start,
      date_to: entities.time_range?.resolved?.end,
      platform: entities.platform,
    }),
  },
  'query.leads.count': {
    method: 'GET',
    endpoint: '/leads',
    paramBuilder: (entities) => ({
      created_after: entities.time_range?.resolved?.start,
      created_before: entities.time_range?.resolved?.end,
      count_only: true,
    }),
  },
  'query.leads.followup': {
    method: 'GET',
    endpoint: '/crm',
    paramBuilder: (entities) => ({
      score_min: entities.lead_temperature === 'hot' ? 70 : 0,
      followup_status: 'overdue',
      sort: 'score_desc',
    }),
  },
  'query.credits.balance': {
    method: 'GET',
    endpoint: '/credits',
    paramBuilder: () => ({}),
  },
  'action.campaign.create': {
    method: 'POST',
    endpoint: '/campaigns',
    paramBuilder: (entities) => ({
      name: entities.campaign_name,
      platform: entities.platform,
      type: entities.campaign_type,
    }),
    requiresConfirmation: true,
  },
  'action.campaign.pause': {
    method: 'PATCH',
    endpoint: '/campaigns/:id',
    resolveFirst: '/campaigns?name={campaign_name}',
    paramBuilder: () => ({ status: 'paused' }),
    requiresConfirmation: true,
  },
  'action.content.generate': {
    method: 'POST',
    endpoint: '/campaigns/content/generate',
    paramBuilder: (entities) => ({
      platform: entities.platform,
      type: entities.content_type || 'post',
      topic: entities.topic,
    }),
    requiresConfirmation: true,
  },
  // ... more mappings
};

export class ActionMapper {
  constructor(private algonitClient: AlgonitClient) {}

  async map(intent: ClassifiedIntent, entities: ExtractedEntities, userContext: UserContext) {
    const mapping = INTENT_API_MAP[intent.fullIntent];
    if (!mapping) {
      throw new Error(`No API mapping for intent: ${intent.fullIntent}`);
    }

    const params = mapping.paramBuilder(entities);

    // Resolve entity references if needed (e.g., campaign name → campaign ID)
    if (mapping.resolveFirst) {
      const resolved = await this.resolveEntity(mapping.resolveFirst, entities, userContext);
      if (resolved) {
        params.id = resolved.id;
      }
    }

    return { mapping, params, requiresConfirmation: mapping.requiresConfirmation };
  }

  async execute(action: MappedAction, userContext: UserContext) {
    return this.algonitClient.request({
      method: action.mapping.method,
      endpoint: action.mapping.endpoint.replace(':id', action.params.id || ''),
      params: action.params,
      tenantId: userContext.tenant_id,
      accessToken: userContext.algonit_token,
    });
  }

  private async resolveEntity(
    resolveEndpoint: string,
    entities: ExtractedEntities,
    userContext: UserContext,
  ) {
    const endpoint = resolveEndpoint.replace(
      '{campaign_name}',
      encodeURIComponent(entities.campaign_name || ''),
    );
    const results = await this.algonitClient.request({
      method: 'GET',
      endpoint,
      params: {},
      tenantId: userContext.tenant_id,
      accessToken: userContext.algonit_token,
    });
    return results.data?.[0] || null;
  }
}
```

### src/services/ai/contextMemory.ts

```typescript
import Redis from 'ioredis';
import type { ConversationContext, ConversationTurn } from '../../types/intent.types';

const CONTEXT_TTL = 86400; // 24 hours
const MAX_TURNS = 20;

export class ContextMemory {
  constructor(private redis: Redis) {}

  async getContext(conversationId: string, tenantId: string): Promise<ConversationContext> {
    const key = `ctx:${tenantId}:${conversationId}`;
    const raw = await this.redis.get(key);

    if (!raw) {
      return { conversationId, recentTurns: [], entities: {} };
    }

    return JSON.parse(raw);
  }

  async updateContext(conversationId: string, turn: ConversationTurn): Promise<void> {
    const key = `ctx:${turn.tenantId}:${conversationId}`;
    const context = await this.getContext(conversationId, turn.tenantId);

    context.recentTurns.push({
      role: 'user',
      content: turn.userMessage,
      intent: turn.intent,
      entities: turn.entities,
      timestamp: turn.timestamp,
    });

    context.recentTurns.push({
      role: 'assistant',
      content: turn.assistantResponse,
      timestamp: turn.timestamp,
    });

    // Keep only last N turns
    if (context.recentTurns.length > MAX_TURNS * 2) {
      context.recentTurns = context.recentTurns.slice(-MAX_TURNS * 2);
    }

    // Merge entities for reference resolution
    Object.assign(context.entities, turn.entities);

    await this.redis.setex(key, CONTEXT_TTL, JSON.stringify(context));
  }

  async resolveReferences(message: string, context: ConversationContext): Promise<string> {
    // Simple pronoun resolution — for complex cases, delegate to LLM
    if (!context.recentTurns.length) return message;

    const lastEntityTurn = [...context.recentTurns]
      .reverse()
      .find((t) => t.entities && Object.keys(t.entities).length > 0);

    if (!lastEntityTurn) return message;

    // Check if message contains unresolved references
    const hasPronouns = /\b(it|that|this|the campaign|the lead)\b/i.test(message);
    if (!hasPronouns) return message;

    // For complex resolution, the LLM handles this in the intent classification step
    return message;
  }

  async clearContext(conversationId: string, tenantId: string): Promise<void> {
    const key = `ctx:${tenantId}:${conversationId}`;
    await this.redis.del(key);
  }
}
```

### src/services/notifications/alert.engine.ts

```typescript
import { CronJob } from 'cron';
import { AlgonitClient } from '../algonit/algonitClient';
import { PushService } from './push.service';
import { LLMRouter } from '../llm/llmRouter';
import { logger } from '../../utils/logger';

interface AlertRule {
  type: string;
  check: (data: any, thresholds: any) => boolean;
  severity: 'high' | 'medium' | 'low';
  generateMessage: (data: any) => string;
}

const ALERT_RULES: AlertRule[] = [
  {
    type: 'hot_lead',
    check: (data) => data.leads?.some((l: any) => l.score >= 80 && !l.contacted),
    severity: 'high',
    generateMessage: (data) => {
      const lead = data.leads.find((l: any) => l.score >= 80 && !l.contacted);
      return `Hot lead detected: ${lead.name} from ${lead.company} (score: ${lead.score}/100)`;
    },
  },
  {
    type: 'campaign_drop',
    check: (data) => {
      return data.campaigns?.some(
        (c: any) => c.performance_change_pct <= -20,
      );
    },
    severity: 'medium',
    generateMessage: (data) => {
      const campaign = data.campaigns.find((c: any) => c.performance_change_pct <= -20);
      return `Campaign "${campaign.name}" dropped ${Math.abs(campaign.performance_change_pct)}% in performance`;
    },
  },
  {
    type: 'budget_alert',
    check: (data, thresholds) => {
      return data.budget?.spent_pct >= (thresholds.budget_threshold_pct || 80);
    },
    severity: 'high',
    generateMessage: (data) =>
      `Budget alert: ${data.budget.spent_pct}% of monthly budget consumed ($${data.budget.spent}/$${data.budget.total})`,
  },
  {
    type: 'credit_low',
    check: (data, thresholds) => {
      return data.credits?.remaining <= (thresholds.credit_threshold || 500);
    },
    severity: 'medium',
    generateMessage: (data) =>
      `AI credits running low: ${data.credits.remaining} remaining out of ${data.credits.total}`,
  },
  {
    type: 'followup_overdue',
    check: (data) => data.followups?.overdue_count > 0,
    severity: 'medium',
    generateMessage: (data) =>
      `${data.followups.overdue_count} follow-ups are overdue. Highest priority: ${data.followups.top_overdue?.name}`,
  },
];

export class AlertEngine {
  private cronJob: CronJob;

  constructor(
    private algonitClient: AlgonitClient,
    private pushService: PushService,
    private llm: LLMRouter,
  ) {
    // Check every 5 minutes
    this.cronJob = new CronJob('*/5 * * * *', () => this.runAlertCheck());
  }

  start() {
    this.cronJob.start();
    logger.info('Alert engine started');
  }

  stop() {
    this.cronJob.stop();
  }

  private async runAlertCheck() {
    try {
      // Get all active tenants
      const tenants = await this.getActiveTenants();

      for (const tenant of tenants) {
        await this.checkTenantAlerts(tenant);
      }
    } catch (error) {
      logger.error({ error }, 'Alert check failed');
    }
  }

  private async checkTenantAlerts(tenant: TenantInfo) {
    // Fetch current data from Algonit APIs
    const data = await this.fetchTenantData(tenant);

    for (const rule of ALERT_RULES) {
      if (rule.check(data, tenant.alert_thresholds)) {
        // Deduplicate: don't send same alert within cooldown period
        const isDuplicate = await this.isDuplicateAlert(tenant.id, rule.type);
        if (isDuplicate) continue;

        const message = rule.generateMessage(data);

        // Send push notification
        await this.pushService.sendToTenant(tenant.id, {
          title: this.getAlertTitle(rule.type),
          body: message,
          severity: rule.severity,
          type: rule.type,
          data,
        });

        // Record alert
        await this.recordAlert(tenant.id, rule.type, message);
      }
    }
  }

  private getAlertTitle(type: string): string {
    const titles: Record<string, string> = {
      hot_lead: 'Hot Lead Detected',
      campaign_drop: 'Campaign Performance Drop',
      budget_alert: 'Budget Threshold Reached',
      credit_low: 'AI Credits Running Low',
      followup_overdue: 'Follow-ups Overdue',
      revenue_spike: 'Revenue Spike Detected',
    };
    return titles[type] || 'Algo Alert';
  }
}
```

### src/services/llm/claudeProvider.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { LLMRequest, LLMResponse, LLMProvider } from './llmProvider';

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: request.maxTokens || 1024,
      system: request.systemPrompt,
      messages: [
        { role: 'user', content: request.prompt },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return {
      content: content.text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      provider: 'claude',
      model: response.model,
    };
  }

  async completeWithTools(request: LLMRequest): Promise<LLMResponse> {
    // For structured intent extraction, use Claude's tool use
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: request.maxTokens || 1024,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.prompt }],
      tools: request.tools,
    });

    return {
      content: JSON.stringify(response.content),
      toolCalls: response.content.filter((b) => b.type === 'tool_use'),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      provider: 'claude',
      model: response.model,
    };
  }
}
```

---

## Environment Configuration (.env.example)

```env
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://algo:password@localhost:5432/algo_db
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# LLM Providers
CLAUDE_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
LLM_PRIMARY_PROVIDER=claude
LLM_FALLBACK_PROVIDER=openai

# Algonit API
ALGONIT_API_BASE_URL=https://api.algonit.com/v1
ALGONIT_API_KEY=xxx

# Auth
JWT_SECRET=xxx
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_EXPIRES_IN=604800
OAUTH_CLIENT_ID=xxx
OAUTH_CLIENT_SECRET=xxx

# Push Notifications
FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
APNS_KEY_ID=xxx
APNS_TEAM_ID=xxx
APNS_KEY_PATH=./apns-key.p8

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=algo-audio
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# Rate Limiting
RATE_LIMIT_CHAT=30
RATE_LIMIT_AUTH=5
RATE_LIMIT_WINDOW=60

# Logging
LOG_LEVEL=info
ELASTICSEARCH_URL=http://localhost:9200
```

---

## Docker Compose (Development)

```yaml
version: '3.8'
services:
  algo-server:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: algo_db
      POSTGRES_USER: algo
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  elasticsearch:
    image: elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

volumes:
  pgdata:
```
