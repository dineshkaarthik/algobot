/**
 * ════════════════════════════════════════════════════════════
 *  ALGO AGENTIC AI CORE
 * ════════════════════════════════════════════════════════════
 *
 *  This is the brain of Algo. It implements a ReAct-style
 *  (Reason + Act) autonomous agent that can:
 *
 *  1. THINK  — Analyze user intent, plan approach
 *  2. PLAN   — Break complex requests into steps
 *  3. ACT    — Execute tools (Algonit APIs) autonomously
 *  4. OBSERVE — Process tool results
 *  5. REFLECT — Self-evaluate and adjust
 *  6. RESPOND — Generate human-like response
 *
 *  The agent uses Claude's tool-use capability to call
 *  Algonit APIs as "tools", enabling autonomous multi-step
 *  task execution with reasoning transparency.
 * ════════════════════════════════════════════════════════════
 */

import { v4 as uuidv4 } from 'uuid';
import type { LLMProvider } from '../llm/llm.provider.js';
import type { AlgonitClient } from '../algonit/algonit.client.js';
import type { ContextMemoryService } from './context.memory.js';
import type { UserContext, AgentReasoningTrace, AgentToolCall, ChatResponse, SuggestedAction } from '../../types/chat.types.js';
import type { ConversationContext } from '../../types/intent.types.js';
import { AGENT_SYSTEM_PROMPT } from './prompts.js';
import { ALGONIT_TOOLS, type AlgonitToolName } from './tools.js';
import { GrowthSummaryService } from '../proactive/growth.summary.js';
import { RecommendationEngine } from '../proactive/recommendation.engine.js';
import { logger } from '../../utils/logger.js';

const MAX_AGENT_ITERATIONS = 8; // Safety limit on tool-call loops

interface AgentInput {
  conversationId: string | null;
  message: string;
  inputType: 'text' | 'voice';
  userContext: UserContext;
}

interface AgentResult {
  conversationId: string;
  messageId: string;
  response: string;
  structuredData?: Record<string, unknown>;
  suggestedActions: SuggestedAction[];
  requiresConfirmation: boolean;
  confirmationId?: string;
  intent: { classified_as: string; confidence: number };
  reasoningTrace: AgentReasoningTrace;
  tokenUsage: { input: number; output: number };
}

export class AlgoAgent {
  constructor(
    private llm: LLMProvider,
    private algonit: AlgonitClient,
    private memory: ContextMemoryService,
  ) {}

  /**
   * Main entry point: process a user message through the agentic loop
   */
  async process(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    const messageId = uuidv4();
    const conversationId = input.conversationId || uuidv4();

    // 1. Load conversation context (memory)
    const context = await this.memory.getContext(conversationId, input.userContext.tenant_id);

    // 2. Build the message history for the LLM
    const systemPrompt = this.buildSystemPrompt(input.userContext);
    const messagesForLLM = this.buildMessages(context, input.message);

    // 3. Run the agentic ReAct loop
    const trace: AgentReasoningTrace = {
      thought: '',
      plan: [],
      observations: [],
      tool_calls: [],
    };

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iteration = 0;
    let finalResponse = '';
    let structuredData: Record<string, unknown> | undefined;
    let suggestedActions: SuggestedAction[] = [];
    let requiresConfirmation = false;
    let confirmationId: string | undefined;
    let classifiedIntent = 'unknown';
    let intentConfidence = 0;

    // The ReAct loop: the agent keeps calling tools until it produces a final text response
    let currentMessages = [...messagesForLLM];

    while (iteration < MAX_AGENT_ITERATIONS) {
      iteration++;

      const llmResponse = await this.llm.createWithTools({
        system: systemPrompt,
        messages: currentMessages,
        tools: ALGONIT_TOOLS,
        maxTokens: 4096,
        temperature: 0.3,
      });

      totalInputTokens += llmResponse.usage.inputTokens;
      totalOutputTokens += llmResponse.usage.outputTokens;

      // Check what the LLM returned
      const toolUseBlocks = llmResponse.content.filter((b) => b.type === 'tool_use');
      const textBlocks = llmResponse.content.filter((b) => b.type === 'text');

      // Extract any text reasoning (the agent's "thinking")
      for (const block of textBlocks) {
        if (block.type === 'text' && block.text) {
          trace.thought += block.text + '\n';
        }
      }

      // If no tool calls, the agent is done thinking and has produced a final response
      if (toolUseBlocks.length === 0) {
        // Extract the final response from text blocks
        const textContent = textBlocks
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('')
          .trim();

        // Parse the structured response if it's JSON
        const parsed = this.parseAgentResponse(textContent);
        finalResponse = parsed.text;
        structuredData = parsed.structuredData;
        suggestedActions = parsed.suggestedActions;
        requiresConfirmation = parsed.requiresConfirmation;
        confirmationId = parsed.confirmationId;
        classifiedIntent = parsed.intent || 'unknown';
        intentConfidence = parsed.confidence || 0;

        break;
      }

      // Execute each tool call and collect results
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const toolCall of toolUseBlocks) {
        if (toolCall.type !== 'tool_use') continue;

        const toolName = toolCall.name as AlgonitToolName;
        const toolInput = toolCall.input as Record<string, unknown>;
        const toolStartTime = Date.now();

        logger.info({ tool: toolName, input: toolInput, iteration }, 'Agent executing tool');

        let toolOutput: Record<string, unknown>;
        let toolStatus: 'success' | 'error' = 'success';
        let toolError: string | undefined;

        try {
          toolOutput = await this.executeTool(toolName, toolInput, input.userContext);
        } catch (err) {
          toolStatus = 'error';
          toolError = err instanceof Error ? err.message : 'Unknown error';
          toolOutput = { error: toolError };
        }

        const toolCallRecord: AgentToolCall = {
          tool: toolName,
          input: toolInput,
          output: toolOutput,
          duration_ms: Date.now() - toolStartTime,
          status: toolStatus,
          error: toolError,
        };

        trace.tool_calls.push(toolCallRecord);
        trace.observations.push(
          `Tool ${toolName}: ${toolStatus === 'success' ? 'returned data' : `error: ${toolError}`}`,
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(toolOutput),
        });
      }

      // Add assistant message (with tool calls) and tool results to conversation
      currentMessages.push({
        role: 'assistant' as const,
        content: llmResponse.content,
      });

      currentMessages.push({
        role: 'user' as const,
        content: toolResults,
      });
    }

    // Safety: if we hit max iterations without a final response
    if (!finalResponse) {
      finalResponse =
        "I've been working on your request but it's quite complex. Here's what I found so far based on my analysis. Could you try rephrasing or breaking your request into smaller parts?";
      trace.reflection = 'Hit maximum iteration limit. Request may be too complex.';
    }

    // 4. Add self-reflection
    trace.reflection = trace.reflection || this.generateReflection(trace);

    // 5. Update conversation memory
    await this.memory.updateContext(conversationId, input.userContext.tenant_id, {
      userMessage: input.message,
      assistantResponse: finalResponse,
      intent: classifiedIntent,
      entities: {},
      timestamp: new Date(),
    });

    logger.info(
      {
        conversationId,
        iterations: iteration,
        toolCalls: trace.tool_calls.length,
        duration_ms: Date.now() - startTime,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
      },
      'Agent completed processing',
    );

    return {
      conversationId,
      messageId,
      response: finalResponse,
      structuredData,
      suggestedActions,
      requiresConfirmation,
      confirmationId,
      intent: { classified_as: classifiedIntent, confidence: intentConfidence },
      reasoningTrace: trace,
      tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
    };
  }

  /**
   * Execute a tool call against Algonit APIs
   */
  private async executeTool(
    toolName: AlgonitToolName,
    input: Record<string, unknown>,
    userContext: UserContext,
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      // Live query tools
      case 'get_profile':
        return this.algonit.getProfile() as any;

      case 'get_credits_balance':
        return this.algonit.getCreditsBalance() as any;

      case 'get_posts':
        return this.algonit.getPosts(
          input.status as string | undefined,
          input.platform as string | undefined,
        ) as any;

      case 'list_campaigns':
        return this.algonit.listCampaigns(
          input.status as string | undefined,
          input.platform as string | undefined,
        ) as any;

      case 'get_campaign_performance':
        return this.algonit.getCampaignPerformance(
          input.campaign_id as string,
        ) as any;

      case 'get_email_campaign_stats':
        return this.algonit.getEmailCampaigns() as any;

      case 'get_market_radar':
        return this.algonit.getMarketRadar() as any;

      case 'get_dashboard_summary':
        return this.algonit.getDashboardSummary() as any;

      case 'get_hot_leads':
        return this.algonit.getHotLeads() as any;

      case 'get_buying_intent':
        return this.algonit.getBuyingIntent() as any;

      case 'get_followup_tasks':
        return this.algonit.getFollowUps() as any;

      case 'get_pipeline_metrics':
        return this.algonit.getDeals() as any;

      case 'get_social_engagement':
        return this.algonit.getSocialEngagement(
          input.platform as string | undefined,
          input.days as number | undefined,
          input.date_from as string | undefined,
          input.date_to as string | undefined,
        ) as any;

      case 'get_leads':
        return this.algonit.getLeads(
          input.source as string | undefined,
          input.stage as string | undefined,
        ) as any;

      case 'get_insights':
        return this.algonit.getInsights(
          input.date_from as string | undefined,
          input.date_to as string | undefined,
          input.platform as string | undefined,
        ) as any;

      case 'get_metrics':
        return this.algonit.getMetrics(
          input.platform as string | undefined,
          input.page_id as string | undefined,
          input.days as number | undefined,
          input.date_from as string | undefined,
          input.date_to as string | undefined,
        ) as any;

      case 'get_follower_growth':
        return this.algonit.getMetricsGrowth() as any;

      case 'sync_social_data':
        return this.algonit.syncSocialData() as any;

      // Growth Copilot tools
      case 'get_growth_summary': {
        const summaryService = new GrowthSummaryService(this.algonit);
        return summaryService.buildSummary(
          userContext.tenant_id,
          (input.period as string) || '7d',
        ) as any;
      }

      case 'get_recommendations': {
        const recEngine = new RecommendationEngine(this.algonit);
        const recs = await recEngine.getActiveRecommendations(userContext.tenant_id);
        return { recommendations: recs } as any;
      }

      case 'accept_recommendation': {
        const recEngine2 = new RecommendationEngine(this.algonit);
        const confirmationId = await recEngine2.acceptRecommendation(
          input.recommendation_id as string,
          userContext.user_id,
          userContext.tenant_id,
        );
        return { confirmation_id: confirmationId, status: 'awaiting_confirmation' } as any;
      }

      // Live action tools
      case 'pause_campaign':
        return this.algonit.pauseCampaign(
          input.campaign_id as string,
        ) as any;

      case 'resume_campaign':
        return this.algonit.resumeCampaign(
          input.campaign_id as string,
        ) as any;

      // Deferred action tools (mock-only)
      case 'create_campaign':
        return this.algonit.createCampaign(input) as any;

      case 'generate_content':
        return this.algonit.generateContent(
          input.platform as string,
          input.topic as string,
          input.tone as string | undefined,
        ) as any;

      case 'trigger_followup':
        return this.algonit.triggerFollowup(
          input.lead_id as string,
          input.method as string | undefined,
        ) as any;

      case 'assign_task':
        return this.algonit.assignTask(
          input.assignee_id as string,
          input.task_type as string,
          input.description as string,
          input.lead_id as string | undefined,
        ) as any;

      case 'generate_report':
        return this.algonit.generateReport(
          input.report_type as string,
          input.date_from as string,
          input.date_to as string,
        ) as any;

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Build the system prompt with user context
   */
  private buildSystemPrompt(userContext: UserContext): string {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return AGENT_SYSTEM_PROMPT
      .replace('{{USER_NAME}}', userContext.name)
      .replace('{{USER_ROLE}}', userContext.role)
      .replace('{{TODAY}}', today)
      .replace('{{CURRENT_TIME}}', time);
  }

  /**
   * Build message history for the LLM from conversation context
   */
  private buildMessages(
    context: ConversationContext,
    currentMessage: string,
  ): Array<{ role: 'user' | 'assistant'; content: any }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];

    // Add recent conversation turns as context
    for (const turn of context.recentTurns.slice(-10)) {
      messages.push({
        role: turn.role,
        content: turn.content,
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Parse the agent's final response — may be structured JSON or plain text
   */
  private parseAgentResponse(text: string): {
    text: string;
    structuredData?: Record<string, unknown>;
    suggestedActions: SuggestedAction[];
    requiresConfirmation: boolean;
    confirmationId?: string;
    intent?: string;
    confidence?: number;
  } {
    // Try to parse as JSON (agent may return structured response)
    try {
      // Check if the response contains a JSON block
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        return {
          text: parsed.text || text.replace(/```json[\s\S]*?```/, '').trim(),
          structuredData: parsed.structured_data,
          suggestedActions: parsed.suggested_actions || [],
          requiresConfirmation: parsed.requires_confirmation || false,
          confirmationId: parsed.confirmation_id,
          intent: parsed.intent,
          confidence: parsed.confidence,
        };
      }

      // Try parsing entire response as JSON
      if (text.startsWith('{')) {
        const parsed = JSON.parse(text);
        return {
          text: parsed.text || parsed.response || text,
          structuredData: parsed.structured_data,
          suggestedActions: parsed.suggested_actions || [],
          requiresConfirmation: parsed.requires_confirmation || false,
          confirmationId: parsed.confirmation_id,
          intent: parsed.intent,
          confidence: parsed.confidence,
        };
      }
    } catch {
      // Not JSON, treat as plain text
    }

    return {
      text,
      suggestedActions: [],
      requiresConfirmation: false,
    };
  }

  /**
   * Generate a self-reflection summary after execution
   */
  private generateReflection(trace: AgentReasoningTrace): string {
    const toolCount = trace.tool_calls.length;
    const errors = trace.tool_calls.filter((t) => t.status === 'error');

    if (toolCount === 0) {
      return 'Answered directly from context without needing API calls.';
    }

    if (errors.length > 0) {
      return `Executed ${toolCount} API calls with ${errors.length} error(s). May need to retry or report data unavailability.`;
    }

    return `Successfully executed ${toolCount} API call(s) to gather data for the response.`;
  }
}
