/**
 * ════════════════════════════════════════════════════════════
 *  STREAMING AGENT — Real-time response streaming
 * ════════════════════════════════════════════════════════════
 *
 *  Extends the base AlgoAgent to support streaming responses
 *  via WebSocket. Instead of waiting for the full response,
 *  users see text appear in real-time — like watching the
 *  agent think and type.
 *
 *  Flow:
 *  1. User sends message
 *  2. Agent starts processing (typing indicator)
 *  3. Agent calls tools (shows "Looking up your data...")
 *  4. Agent streams response chunks via WebSocket
 *  5. Final response also saved to DB
 * ════════════════════════════════════════════════════════════
 */

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { getEnv } from '../../config/env.js';
import type { AlgonitClient } from '../algonit/algonit.client.js';
import type { ContextMemoryService } from './context.memory.js';
import type { UserContext, AgentReasoningTrace, AgentToolCall } from '../../types/chat.types.js';
import type { ConversationContext } from '../../types/intent.types.js';
import { ALGONIT_TOOLS, type AlgonitToolName } from './tools.js';
import { AGENT_SYSTEM_PROMPT } from './prompts.js';
import { GrowthSummaryService } from '../proactive/growth.summary.js';
import { RecommendationEngine } from '../proactive/recommendation.engine.js';
import {
  sendTypingIndicator,
  streamResponseToUser,
  sendToUser,
} from '../websocket/ws.server.js';
import { logger } from '../../utils/logger.js';

const MAX_ITERATIONS = 8;

interface StreamingAgentInput {
  conversationId: string;
  message: string;
  inputType: 'text' | 'voice';
  userContext: UserContext;
}

interface StreamingAgentResult {
  conversationId: string;
  messageId: string;
  fullResponse: string;
  structuredData?: Record<string, unknown>;
  suggestedActions: Array<{ label: string; action: string; params: Record<string, unknown> }>;
  requiresConfirmation: boolean;
  confirmationId?: string;
  intent: { classified_as: string; confidence: number };
  reasoningTrace: AgentReasoningTrace;
  tokenUsage: { input: number; output: number };
}

export class StreamingAgent {
  private client: Anthropic;
  private model: string;

  constructor(
    private algonit: AlgonitClient,
    private memory: ContextMemoryService,
  ) {
    this.client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
    this.model = 'claude-sonnet-4-6';
  }

  /**
   * Process a message with real-time streaming to the user's WebSocket
   */
  async processWithStreaming(input: StreamingAgentInput): Promise<StreamingAgentResult> {
    const messageId = uuidv4();
    const startTime = Date.now();

    // Send typing indicator
    sendTypingIndicator(input.userContext.user_id, input.conversationId, true);

    // Load context
    const context = await this.memory.getContext(
      input.conversationId,
      input.userContext.tenant_id,
    );

    const systemPrompt = this.buildSystemPrompt(input.userContext);
    const messages = this.buildMessages(context, input.message);

    const trace: AgentReasoningTrace = {
      thought: '',
      plan: [],
      observations: [],
      tool_calls: [],
    };

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iteration = 0;
    let fullResponse = '';
    let currentMessages = [...messages];

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      // Check if this iteration requires tool use or will be final
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: 0.3,
        system: systemPrompt,
        messages: currentMessages as any,
        tools: ALGONIT_TOOLS as any,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const textBlocks = response.content.filter((b) => b.type === 'text');

      // If no tool calls, this is the final response — stream it
      if (toolUseBlocks.length === 0) {
        sendTypingIndicator(input.userContext.user_id, input.conversationId, false);

        const textContent = textBlocks
          .map((b) => (b.type === 'text' ? b.text : ''))
          .join('');

        // Stream the response in chunks
        fullResponse = textContent;
        await this.streamText(input.userContext.user_id, input.conversationId, textContent);

        // Signal stream end
        streamResponseToUser(
          input.userContext.user_id,
          input.conversationId,
          '',
          true,
          messageId,
        );

        break;
      }

      // Tool calls needed — notify user
      sendToUser(input.userContext.user_id, {
        type: 'agent_status',
        conversation_id: input.conversationId,
        status: 'working',
        message: this.getStatusMessage(toolUseBlocks as any),
        timestamp: new Date().toISOString(),
      });

      // Execute tools
      const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

      for (const toolCall of toolUseBlocks) {
        if (toolCall.type !== 'tool_use') continue;

        const toolStartTime = Date.now();
        let toolOutput: Record<string, unknown>;
        let toolStatus: 'success' | 'error' = 'success';
        let toolError: string | undefined;

        try {
          toolOutput = await this.executeTool(
            toolCall.name as AlgonitToolName,
            toolCall.input as Record<string, unknown>,
            input.userContext,
          );
        } catch (err) {
          toolStatus = 'error';
          toolError = err instanceof Error ? err.message : 'Unknown error';
          toolOutput = { error: toolError };
        }

        trace.tool_calls.push({
          tool: toolCall.name,
          input: toolCall.input as Record<string, unknown>,
          output: toolOutput,
          duration_ms: Date.now() - toolStartTime,
          status: toolStatus,
          error: toolError,
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(toolOutput),
        });
      }

      // Add to message chain
      currentMessages.push({ role: 'assistant' as const, content: response.content as any });
      currentMessages.push({ role: 'user' as const, content: toolResults as any });

      // Collect text from intermediary blocks
      for (const block of textBlocks) {
        if (block.type === 'text') trace.thought += block.text + '\n';
      }
    }

    // Update memory
    await this.memory.updateContext(input.conversationId, input.userContext.tenant_id, {
      userMessage: input.message,
      assistantResponse: fullResponse,
      intent: 'unknown',
      entities: {},
      timestamp: new Date(),
    });

    // Parse structured response
    const parsed = this.parseResponse(fullResponse);

    logger.info({
      conversationId: input.conversationId,
      iterations: iteration,
      toolCalls: trace.tool_calls.length,
      duration_ms: Date.now() - startTime,
      streamed: true,
    }, 'Streaming agent completed');

    return {
      conversationId: input.conversationId,
      messageId,
      fullResponse: parsed.text,
      structuredData: parsed.structuredData,
      suggestedActions: parsed.suggestedActions,
      requiresConfirmation: parsed.requiresConfirmation,
      confirmationId: parsed.confirmationId,
      intent: { classified_as: parsed.intent || 'unknown', confidence: parsed.confidence || 0 },
      reasoningTrace: trace,
      tokenUsage: { input: totalInputTokens, output: totalOutputTokens },
    };
  }

  /**
   * Stream text to user in natural-feeling chunks
   */
  private async streamText(userId: string, conversationId: string, text: string): Promise<void> {
    // Split into sentences for natural streaming
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];

    for (const sentence of sentences) {
      // Stream word by word within each sentence for a natural feel
      const words = sentence.split(' ');
      let chunk = '';

      for (let i = 0; i < words.length; i++) {
        chunk += (i > 0 ? ' ' : '') + words[i];

        // Send every 3-5 words for natural pacing
        if (chunk.split(' ').length >= 3 || i === words.length - 1) {
          streamResponseToUser(userId, conversationId, chunk, false);
          chunk = '';

          // Small delay for natural feel (15-30ms)
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    }
  }

  /**
   * Generate a user-friendly status message for tool calls
   */
  private getStatusMessage(toolCalls: Array<{ name: string }>): string {
    const toolNames = toolCalls.map((t) => t.name);

    if (toolNames.includes('get_growth_summary')) {
      return 'Analyzing your growth metrics...';
    }
    if (toolNames.includes('get_recommendations')) {
      return 'Generating recommendations...';
    }
    if (toolNames.includes('accept_recommendation')) {
      return 'Processing your recommendation...';
    }
    if (toolNames.includes('get_insights')) {
      return 'Analyzing your content performance...';
    }
    if (toolNames.includes('get_campaign_performance') || toolNames.includes('get_social_engagement')) {
      return 'Checking your campaign performance...';
    }
    if (toolNames.includes('get_leads') || toolNames.includes('get_hot_leads')) {
      return 'Looking up your leads...';
    }
    if (toolNames.includes('get_followup_tasks')) {
      return 'Checking follow-up tasks...';
    }
    if (toolNames.includes('get_credits_balance')) {
      return 'Checking your credit balance...';
    }
    if (toolNames.includes('get_pipeline_metrics') || toolNames.includes('get_deals')) {
      return 'Pulling pipeline data...';
    }
    if (toolNames.includes('get_dashboard_summary')) {
      return 'Getting your dashboard summary...';
    }
    if (toolNames.includes('get_buying_intent')) {
      return 'Checking buying intent signals...';
    }
    if (toolNames.includes('get_market_radar')) {
      return 'Scanning market radar...';
    }
    if (toolNames.includes('get_posts')) {
      return 'Looking at your posts...';
    }
    if (toolNames.includes('list_campaigns')) {
      return 'Looking through your campaigns...';
    }
    if (toolNames.some((n) => n.startsWith('pause_') || n.startsWith('resume_') || n.startsWith('create_'))) {
      return 'Preparing that action for you...';
    }
    if (toolNames.includes('generate_content')) {
      return 'Generating content...';
    }
    if (toolNames.includes('generate_report')) {
      return 'Generating your report...';
    }

    return 'Working on it...';
  }

  // Reuse methods from base agent
  private buildSystemPrompt(userContext: UserContext): string {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return AGENT_SYSTEM_PROMPT
      .replace('{{USER_NAME}}', userContext.name)
      .replace('{{USER_ROLE}}', userContext.role)
      .replace('{{TODAY}}', today)
      .replace('{{CURRENT_TIME}}', time);
  }

  private buildMessages(context: ConversationContext, currentMessage: string) {
    const messages: Array<{ role: 'user' | 'assistant'; content: any }> = [];
    for (const turn of context.recentTurns.slice(-10)) {
      messages.push({ role: turn.role, content: turn.content });
    }
    messages.push({ role: 'user', content: currentMessage });
    return messages;
  }

  private async executeTool(
    toolName: AlgonitToolName,
    input: Record<string, unknown>,
    userContext: UserContext,
  ): Promise<Record<string, unknown>> {
    const methodMap: Record<string, () => Promise<any>> = {
      // Live query tools
      get_profile: () => this.algonit.getProfile(),
      get_credits_balance: () => this.algonit.getCreditsBalance(),
      get_posts: () => this.algonit.getPosts(input.status as string, input.platform as string),
      list_campaigns: () => this.algonit.listCampaigns(input.status as string, input.platform as string),
      get_campaign_performance: () => this.algonit.getCampaignPerformance(input.campaign_id as string),
      get_email_campaign_stats: () => this.algonit.getEmailCampaigns(),
      get_market_radar: () => this.algonit.getMarketRadar(),
      get_dashboard_summary: () => this.algonit.getDashboardSummary(),
      get_hot_leads: () => this.algonit.getHotLeads(),
      get_buying_intent: () => this.algonit.getBuyingIntent(),
      get_followup_tasks: () => this.algonit.getFollowUps(),
      get_pipeline_metrics: () => this.algonit.getDeals(),
      get_social_engagement: () => this.algonit.getSocialEngagement(input.platform as string),
      get_leads: () => this.algonit.getLeads(input.source as string, input.stage as string),
      get_insights: () => this.algonit.getInsights(input.date_from as string, input.date_to as string, input.platform as string),
      // Growth Copilot tools
      get_growth_summary: () => new GrowthSummaryService(this.algonit).buildSummary(userContext.tenant_id, (input.period as string) || '7d'),
      get_recommendations: () => new RecommendationEngine(this.algonit).getActiveRecommendations(userContext.tenant_id).then((r) => ({ recommendations: r })),
      accept_recommendation: () => new RecommendationEngine(this.algonit).acceptRecommendation(input.recommendation_id as string, userContext.user_id, userContext.tenant_id).then((id) => ({ confirmation_id: id, status: 'awaiting_confirmation' })),
      // Live action tools
      pause_campaign: () => this.algonit.pauseCampaign(input.campaign_id as string),
      resume_campaign: () => this.algonit.resumeCampaign(input.campaign_id as string),
      // Deferred action tools (mock-only)
      create_campaign: () => this.algonit.createCampaign(input),
      generate_content: () => this.algonit.generateContent(input.platform as string, input.topic as string, input.tone as string),
      trigger_followup: () => this.algonit.triggerFollowup(input.lead_id as string, input.method as string),
      assign_task: () => this.algonit.assignTask(input.assignee_id as string, input.task_type as string, input.description as string, input.lead_id as string),
      generate_report: () => this.algonit.generateReport(input.report_type as string, input.date_from as string, input.date_to as string),
    };

    const method = methodMap[toolName];
    if (!method) throw new Error(`Unknown tool: ${toolName}`);
    return method();
  }

  private parseResponse(text: string) {
    try {
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
      if (text.startsWith('{')) {
        const parsed = JSON.parse(text);
        return {
          text: parsed.text || text,
          structuredData: parsed.structured_data,
          suggestedActions: parsed.suggested_actions || [],
          requiresConfirmation: parsed.requires_confirmation || false,
          confirmationId: parsed.confirmation_id,
          intent: parsed.intent,
          confidence: parsed.confidence,
        };
      }
    } catch {}

    return { text, suggestedActions: [], requiresConfirmation: false };
  }
}
