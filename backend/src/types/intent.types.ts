// ─── Intent Classification ───────────────────────────────

export type IntentCategory = 'query' | 'action' | 'navigation' | 'system' | 'unknown';

export type IntentDomain =
  | 'social'
  | 'campaign'
  | 'leads'
  | 'email'
  | 'credits'
  | 'revenue'
  | 'analytics'
  | 'content'
  | 'followup'
  | 'task'
  | 'report'
  | 'lead'
  | 'dashboard'
  | 'campaigns'
  | 'settings'
  | 'help'
  | 'greeting'
  | 'feedback';

export interface ClassifiedIntent {
  category: IntentCategory;
  domain: string;
  action: string;
  fullIntent: string;
  confidence: number;
  requiresConfirmation: boolean;
}

// ─── Entity Extraction ───────────────────────────────────

export interface ExtractedEntities {
  time_range?: {
    value: string;
    resolved: { start: string; end: string };
  };
  platform?: string;
  campaign_name?: string;
  campaign_id?: string;
  metrics?: string[];
  lead_temperature?: 'hot' | 'warm' | 'cold';
  person_name?: string;
  company_name?: string;
  content_type?: string;
  topic?: string;
  assignee_name?: string;
  [key: string]: unknown;
}

// ─── Conversation Context ────────────────────────────────

export interface ConversationContext {
  conversationId: string;
  recentTurns: ConversationTurn[];
  entities: Record<string, unknown>; // Accumulated entities for reference resolution
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  intent?: ClassifiedIntent;
  entities?: ExtractedEntities;
  timestamp: Date;
}

// ─── API Mapping ─────────────────────────────────────────

export interface ApiMapping {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  paramBuilder: (entities: ExtractedEntities) => Record<string, unknown>;
  resolveFirst?: string;
  requiresConfirmation?: boolean;
}
