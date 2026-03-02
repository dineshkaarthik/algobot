// ─── Chat Request/Response Types ─────────────────────────

export interface ChatRequest {
  conversation_id: string | null;
  message: string;
  input_type: 'text' | 'voice';
  audio_url?: string;
  context?: {
    screen?: string;
    selected_campaign_id?: string;
  };
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  response: {
    text: string;
    structured_data?: StructuredData;
    suggested_actions?: SuggestedAction[];
    requires_confirmation: boolean;
    confirmation_id?: string;
  };
  intent: {
    classified_as: string;
    confidence: number;
  };
  reasoning_summary?: string; // Agentic: summary of agent's thought process
  timestamp: string;
}

export interface StructuredData {
  type: string;
  metrics?: Array<Record<string, unknown>>;
  chart_type?: 'bar' | 'line' | 'pie' | 'none';
  time_range?: string;
  [key: string]: unknown;
}

export interface SuggestedAction {
  label: string;
  action: string;
  params: Record<string, unknown>;
}

export interface ConfirmRequest {
  conversation_id: string;
  confirmation_id: string;
  confirmed: boolean;
}

// ─── User Context (passed to AI agent) ───────────────────

export interface UserContext {
  user_id: string;
  tenant_id: string;
  role: string;
  name: string;
  algonit_token?: string;
}

// ─── Conversation Types ──────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string | null;
  last_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageRecord {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  input_type?: string;
  structured_data?: StructuredData;
  suggested_actions?: SuggestedAction[];
  intent?: Record<string, unknown>;
  reasoning_trace?: AgentReasoningTrace;
  timestamp: string;
}

// ─── Agentic Types ───────────────────────────────────────

export interface AgentReasoningTrace {
  thought: string;           // What the agent is thinking
  plan: string[];            // Steps the agent plans to take
  observations: string[];    // What the agent observed from tool calls
  reflection?: string;       // Self-evaluation after execution
  tool_calls: AgentToolCall[];
}

export interface AgentToolCall {
  tool: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration_ms?: number;
  status: 'success' | 'error';
  error?: string;
}
