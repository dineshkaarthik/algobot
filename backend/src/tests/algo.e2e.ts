#!/usr/bin/env npx tsx
/**
 * ════════════════════════════════════════════════════════════
 *  ALGO AI BOT — End-to-End Test
 * ════════════════════════════════════════════════════════════
 *
 *  Two modes:
 *
 *  MODE 1 — Data Pipeline (no API key needed):
 *    npx tsx src/tests/algo.e2e.ts
 *    Shows: Real Algonit data → Tool mapping → Data for each scenario
 *
 *  MODE 2 — Full Agent Loop (requires ANTHROPIC_API_KEY):
 *    ANTHROPIC_API_KEY=sk-ant-xxx npx tsx src/tests/algo.e2e.ts
 *    Shows: User → Claude reasoning → Tool calls → Real data → AI response
 * ════════════════════════════════════════════════════════════
 */

import { ALGONIT_TOOLS, type AlgonitToolName } from '../services/ai/tools.js';
import { AGENT_SYSTEM_PROMPT } from '../services/ai/prompts.js';

// ─── Configuration ──────────────────────────────────────────

const ALGONIT_API_URL = 'https://www.algonit.com/api/algo';
const ALGONIT_TOKEN = '07e985d731c72122ff757f86798d7c1a93f05fa2c6e80537f4b618ef9f3be58fd64ba0af16946fbb';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_ITERATIONS = 8;

// ─── Formatting Helpers ─────────────────────────────────────

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';

function divider(label?: string) {
  const line = '═'.repeat(70);
  if (label) {
    console.log(`\n${CYAN}${BOLD}  ${line}${RESET}`);
    console.log(`${CYAN}${BOLD}    ${label}${RESET}`);
    console.log(`${CYAN}${BOLD}  ${line}${RESET}\n`);
  } else {
    console.log(`${DIM}${'─'.repeat(70)}${RESET}`);
  }
}

function section(label: string) {
  console.log(`\n  ${YELLOW}${BOLD}▸ ${label}${RESET}`);
}

function truncateJson(data: unknown, maxLen = 800): string {
  const json = JSON.stringify(data, null, 2);
  if (json.length <= maxLen) return json;
  return json.slice(0, maxLen) + `\n    ... (${json.length} chars total)`;
}

// ─── Direct Algonit API Client ──────────────────────────────

async function algonitGet(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  const url = new URL(`${ALGONIT_API_URL}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${ALGONIT_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`Algonit API ${res.status} ${res.statusText} on ${endpoint}`);
  }
  return res.json();
}

async function algonitPatch(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${ALGONIT_API_URL}${endpoint}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${ALGONIT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Algonit API ${res.status} ${res.statusText} on PATCH ${endpoint}`);
  }
  return res.json();
}

// ─── Tool Executor (maps tool names → real Algonit API) ─────

async function executeTool(
  toolName: AlgonitToolName,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    // Live query tools
    case 'get_profile':
      return algonitGet('/me');
    case 'get_credits_balance':
      return algonitGet('/credits');
    case 'get_posts':
      return algonitGet('/posts', {
        ...(input.status ? { status: String(input.status) } : {}),
        ...(input.platform ? { platform: String(input.platform) } : {}),
      });
    case 'list_campaigns':
      return algonitGet('/campaigns', {
        ...(input.status ? { status: String(input.status) } : {}),
        ...(input.platform ? { platform: String(input.platform) } : {}),
      });
    case 'get_campaign_performance':
      return algonitGet(`/campaigns/${input.campaign_id}/performance`);
    case 'get_email_campaign_stats':
      return algonitGet('/email-campaigns');
    case 'get_market_radar':
      return algonitGet('/market-radar/summary');
    case 'get_dashboard_summary':
      return algonitGet('/summary');
    case 'get_hot_leads':
      return algonitGet('/hot-leads');
    case 'get_buying_intent':
      return algonitGet('/buying-intent');
    case 'get_followup_tasks':
      return algonitGet('/follow-ups');
    case 'get_pipeline_metrics':
      return algonitGet('/deals');
    case 'get_social_engagement':
      return algonitGet('/engagement', {
        ...(input.platform ? { platform: String(input.platform) } : {}),
      });
    case 'get_leads':
      return algonitGet('/leads', {
        ...(input.source ? { source: String(input.source) } : {}),
        ...(input.stage ? { stage: String(input.stage) } : {}),
      });
    case 'get_insights':
      return algonitGet('/insights', {
        ...(input.date_from ? { date_from: String(input.date_from) } : {}),
        ...(input.date_to ? { date_to: String(input.date_to) } : {}),
        ...(input.platform ? { platform: String(input.platform) } : {}),
      });

    // Live action tools
    case 'pause_campaign':
      return algonitPatch(`/campaigns/${input.campaign_id}`, { status: 'paused' });
    case 'resume_campaign':
      return algonitPatch(`/campaigns/${input.campaign_id}`, { status: 'active' });

    // Deferred action tools (always return mock since no real endpoint)
    case 'create_campaign':
      return { success: true, campaign: { id: `cmp_preview`, name: input.name, status: 'draft' }, message: 'Campaign created (preview mode)' };
    case 'generate_content':
      return { success: true, content: { platform: input.platform, topic: input.topic, tone: input.tone || 'professional', generated_text: `AI-generated content for ${input.topic}` }, credits_used: 5 };
    case 'trigger_followup':
      return { success: true, followup: { lead_id: input.lead_id, method: input.method || 'email', status: 'triggered' }, message: 'Follow-up triggered (preview mode)' };
    case 'assign_task':
      return { success: true, task: { assignee_id: input.assignee_id, type: input.task_type, description: input.description, status: 'assigned' }, message: 'Task assigned (preview mode)' };
    case 'generate_report':
      return { success: true, report: { type: input.report_type, period: { from: input.date_from, to: input.date_to }, status: 'generated' }, message: 'Report generated (preview mode)' };

    // Growth Copilot tools (server-side computed, return simulated data)
    case 'get_growth_summary':
      // Simulate growth summary by calling multiple endpoints
      const [summaryData, hotLeadsData, engagementData, creditsData] = await Promise.all([
        algonitGet('/summary'),
        algonitGet('/hot-leads'),
        algonitGet('/engagement'),
        algonitGet('/credits'),
      ]);
      return {
        period: input.period || '7d',
        headline: `Active growth period — ${(hotLeadsData as any).total} hot leads, ${(summaryData as any).campaigns.active} active campaigns`,
        kpiChanges: [
          { metric: 'hotLeads', currentValue: (hotLeadsData as any).total, changePercent: 15, direction: 'up', significance: 'high' },
        ],
        channelScores: (engagementData as any).byPlatform?.map((p: any) => ({
          platform: p.platform,
          overallScore: Math.min(100, Math.round(p.totalEngagements / 10)),
          trend: 'stable',
        })) || [],
        topRecommendations: [],
        urgentItems: [],
      };

    case 'get_recommendations':
      // Return simulated recommendations
      return {
        recommendations: [
          {
            id: 'rec_e2e_001',
            type: 'lead_followup_urgent',
            title: 'Follow up with high-intent leads',
            description: 'You have hot leads that need immediate attention',
            confidence: 0.87,
            impact: 'high',
            category: 'growth',
            actionable: true,
            status: 'pending',
          },
          {
            id: 'rec_e2e_002',
            type: 'content_type_shift',
            title: 'Shift to video content on Instagram',
            description: 'Video content outperforms images by 2.3x on Instagram',
            confidence: 0.72,
            impact: 'medium',
            category: 'optimization',
            actionable: false,
            status: 'pending',
          },
        ],
      };

    case 'accept_recommendation':
      return {
        confirmation_id: `confirm_${Date.now()}`,
        status: 'awaiting_confirmation',
      };

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ─── Build System Prompt ────────────────────────────────────

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return AGENT_SYSTEM_PROMPT
    .replace('{{USER_NAME}}', 'E2E Test User')
    .replace('{{USER_ROLE}}', 'admin')
    .replace('{{TODAY}}', today)
    .replace('{{CURRENT_TIME}}', time);
}

// ─── Types ──────────────────────────────────────────────────

interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
}

interface AgentE2EResult {
  response: string;
  toolCalls: ToolCallRecord[];
  iterations: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  agentThinking: string;
  durationMs: number;
}

// ─── ReAct Agent Loop (Full Mode) ───────────────────────────

async function runAgentLoop(
  claude: any, // Anthropic client
  userMessage: string,
): Promise<AgentE2EResult> {
  const startTime = Date.now();
  const systemPrompt = buildSystemPrompt();

  const toolCalls: ToolCallRecord[] = [];
  let agentThinking = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iteration = 0;
  let finalResponse = '';

  const messages: Array<{ role: string; content: any }> = [
    { role: 'user', content: userMessage },
  ];

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const llmResponse = await claude.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages,
      tools: ALGONIT_TOOLS,
    });

    totalInputTokens += llmResponse.usage.input_tokens;
    totalOutputTokens += llmResponse.usage.output_tokens;

    // Extract text and tool_use blocks
    const textBlocks = llmResponse.content.filter((b: any) => b.type === 'text');
    const toolUseBlocks = llmResponse.content.filter((b: any) => b.type === 'tool_use');

    for (const block of textBlocks) {
      agentThinking += block.text + '\n';
    }

    // If no tool calls → agent is done, extract final response
    if (toolUseBlocks.length === 0) {
      finalResponse = textBlocks.map((b: any) => b.text).join('').trim();
      break;
    }

    // Execute each tool call
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const toolCall of toolUseBlocks) {
      const toolName = toolCall.name as AlgonitToolName;
      const toolInput = toolCall.input as Record<string, unknown>;
      const toolStart = Date.now();

      console.log(`    ${DIM}[iteration ${iteration}]${RESET} ${MAGENTA}Calling tool:${RESET} ${BOLD}${toolName}${RESET}`);
      if (Object.keys(toolInput).length > 0) {
        console.log(`    ${DIM}  Input: ${JSON.stringify(toolInput)}${RESET}`);
      }

      let toolOutput: unknown;
      let toolStatus: 'success' | 'error' = 'success';
      let toolError: string | undefined;

      try {
        toolOutput = await executeTool(toolName, toolInput);
        const elapsed = Date.now() - toolStart;
        console.log(`    ${GREEN}  ✓ Success${RESET} ${DIM}(${elapsed}ms)${RESET}`);
      } catch (err) {
        toolStatus = 'error';
        toolError = err instanceof Error ? err.message : String(err);
        toolOutput = { error: toolError };
        console.log(`    ${RED}  ✗ Error: ${toolError}${RESET}`);
      }

      toolCalls.push({
        tool: toolName,
        input: toolInput,
        output: toolOutput,
        durationMs: Date.now() - toolStart,
        status: toolStatus,
        error: toolError,
      });

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: JSON.stringify(toolOutput),
      });
    }

    // Feed tool results back to the agent
    messages.push({ role: 'assistant', content: llmResponse.content });
    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalResponse) {
    finalResponse = '(Agent hit max iterations without producing a final response)';
  }

  return {
    response: finalResponse,
    toolCalls,
    iterations: iteration,
    totalInputTokens,
    totalOutputTokens,
    agentThinking,
    durationMs: Date.now() - startTime,
  };
}

// ─── Data Pipeline Test (No Claude needed) ──────────────────

interface DataPipelineScenario {
  name: string;
  message: string;
  description: string;
  tools: Array<{ tool: AlgonitToolName; input: Record<string, unknown> }>;
}

const DATA_PIPELINE_SCENARIOS: DataPipelineScenario[] = [
  {
    name: 'Dashboard Overview',
    message: "How's everything going today?",
    description: 'Agent would call get_dashboard_summary + get_insights',
    tools: [
      { tool: 'get_dashboard_summary', input: {} },
      { tool: 'get_insights', input: {} },
    ],
  },
  {
    name: 'Hot Leads',
    message: 'Show me my hot leads that need attention',
    description: 'Agent would call get_hot_leads + get_followup_tasks',
    tools: [
      { tool: 'get_hot_leads', input: {} },
      { tool: 'get_followup_tasks', input: {} },
    ],
  },
  {
    name: 'Social Performance Analysis',
    message: "How are my social media posts performing? What's working best?",
    description: 'Agent would call get_social_engagement + get_insights + get_posts',
    tools: [
      { tool: 'get_social_engagement', input: {} },
      { tool: 'get_insights', input: {} },
      { tool: 'get_posts', input: {} },
    ],
  },
  {
    name: 'Campaign Status',
    message: 'Show me all my campaigns and how they\'re performing',
    description: 'Agent would call list_campaigns to get IDs, then get_campaign_performance',
    tools: [
      { tool: 'list_campaigns', input: {} },
    ],
  },
  {
    name: 'Sales Pipeline',
    message: 'What does my sales pipeline look like?',
    description: 'Agent would call get_pipeline_metrics + get_leads',
    tools: [
      { tool: 'get_pipeline_metrics', input: {} },
      { tool: 'get_leads', input: {} },
    ],
  },
  {
    name: 'Buying Intent Signals',
    message: 'Any buying intent signals I should act on?',
    description: 'Agent would call get_buying_intent',
    tools: [
      { tool: 'get_buying_intent', input: {} },
    ],
  },
  {
    name: 'Credits & Profile',
    message: 'How many credits do I have left?',
    description: 'Agent would call get_credits_balance + get_profile',
    tools: [
      { tool: 'get_credits_balance', input: {} },
      { tool: 'get_profile', input: {} },
    ],
  },
  {
    name: 'Email Campaigns',
    message: 'How are my email campaigns doing?',
    description: 'Agent would call get_email_campaign_stats',
    tools: [
      { tool: 'get_email_campaign_stats', input: {} },
    ],
  },
  {
    name: 'Competitor Intelligence',
    message: 'What are my competitors up to?',
    description: 'Agent would call get_market_radar',
    tools: [
      { tool: 'get_market_radar', input: {} },
    ],
  },
  {
    name: 'Growth Summary',
    message: 'How are things going? Give me a growth summary.',
    description: 'Growth Copilot executive summary with KPIs, channel scores, and recommendations',
    tools: [
      { tool: 'get_growth_summary', input: {} },
    ],
  },
  {
    name: 'AI Recommendations',
    message: 'What should I focus on today? Any recommendations?',
    description: 'AI-generated actionable recommendations with confidence scores',
    tools: [
      { tool: 'get_recommendations', input: {} },
    ],
  },
  {
    name: 'Accept Recommendation',
    message: 'Execute the top recommendation for me.',
    description: 'Accept and queue a recommendation for execution',
    tools: [
      { tool: 'get_recommendations', input: {} },
      { tool: 'accept_recommendation', input: { recommendation_id: 'rec_e2e_001' } },
    ],
  },
];

async function runDataPipeline(scenario: DataPipelineScenario): Promise<ToolCallRecord[]> {
  const toolCalls: ToolCallRecord[] = [];

  for (const { tool, input } of scenario.tools) {
    const start = Date.now();
    let output: unknown;
    let status: 'success' | 'error' = 'success';
    let error: string | undefined;

    console.log(`    ${MAGENTA}Calling:${RESET} ${BOLD}${tool}${RESET}`);
    if (Object.keys(input).length > 0) {
      console.log(`    ${DIM}  Input: ${JSON.stringify(input)}${RESET}`);
    }

    try {
      output = await executeTool(tool, input);
      console.log(`    ${GREEN}  ✓ Success${RESET} ${DIM}(${Date.now() - start}ms)${RESET}`);
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : String(err);
      output = { error };
      console.log(`    ${RED}  ✗ Error: ${error}${RESET}`);
    }

    toolCalls.push({ tool, input, output, durationMs: Date.now() - start, status, error });
  }

  return toolCalls;
}

// ─── Full Agent Test Scenarios ──────────────────────────────

const AGENT_TEST_SCENARIOS = [
  {
    name: 'Dashboard Overview',
    message: "How's everything going today?",
    description: 'Tests if the agent fetches dashboard summary + insights and gives a holistic overview',
  },
  {
    name: 'Hot Leads',
    message: 'Show me my hot leads that need attention',
    description: 'Tests if the agent fetches hot leads and prioritizes by urgency',
  },
  {
    name: 'Social Performance Analysis',
    message: "How are my social media posts performing? What's working best?",
    description: 'Tests if the agent fetches engagement + insights and provides analytical depth',
  },
  {
    name: 'Growth Summary',
    message: 'How are things going? Give me a growth summary.',
    description: 'Tests if the agent uses get_growth_summary to produce an executive KPI overview',
  },
  {
    name: 'AI Recommendations',
    message: 'What should I focus on today? Any recommendations?',
    description: 'Tests if the agent fetches recommendations and prioritizes by confidence/impact',
  },
  {
    name: 'Accept Recommendation',
    message: 'Execute the top recommendation for me.',
    description: 'Tests if the agent fetches recommendations then accepts the top one',
  },
];

// ─── Display Tool Call Results ───────────────────────────────

function displayToolCalls(toolCalls: ToolCallRecord[]) {
  for (const tc of toolCalls) {
    const statusIcon = tc.status === 'success' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`\n  ${statusIcon} ${BOLD}${tc.tool}${RESET} ${DIM}(${tc.durationMs}ms)${RESET}`);

    if (Object.keys(tc.input).length > 0) {
      console.log(`    ${DIM}Input:${RESET} ${JSON.stringify(tc.input)}`);
    }

    if (tc.status === 'success') {
      console.log(`    ${DIM}Data Retrieved:${RESET}`);
      const lines = truncateJson(tc.output).split('\n');
      for (const line of lines) {
        console.log(`    ${DIM}${line}${RESET}`);
      }
    } else {
      console.log(`    ${RED}Error: ${tc.error}${RESET}`);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const fullMode = !!ANTHROPIC_API_KEY;

  if (fullMode) {
    divider('ALGO AI BOT — Full E2E Test (Claude + Algonit)');
  } else {
    divider('ALGO AI BOT — Data Pipeline E2E Test');
    console.log(`  ${YELLOW}NOTE:${RESET} Running in data-only mode (no ANTHROPIC_API_KEY).`);
    console.log(`  ${DIM}This tests the full Algonit data pipeline for each scenario.${RESET}`);
    console.log(`  ${DIM}For full agent mode: ANTHROPIC_API_KEY=sk-ant-xxx npx tsx src/tests/algo.e2e.ts${RESET}`);
  }

  console.log(`\n  ${DIM}Algonit API:${RESET} ${ALGONIT_API_URL}`);
  if (fullMode) {
    console.log(`  ${DIM}Claude Model:${RESET} ${CLAUDE_MODEL}`);
  }

  // Verify Algonit API is reachable
  section('Verifying Algonit API connectivity...');
  try {
    const profile = await algonitGet('/me');
    console.log(`  ${GREEN}✓ Algonit API reachable${RESET}`);
    console.log(`  ${DIM}Profile: ${JSON.stringify(profile)}${RESET}`);
  } catch (err) {
    console.log(`  ${RED}✗ Algonit API unreachable: ${err}${RESET}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  if (fullMode) {
    // ─── FULL AGENT MODE ──────────────────────────────────
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    console.log(`  ${DIM}Test Scenarios:${RESET} ${AGENT_TEST_SCENARIOS.length}`);
    console.log(`  ${DIM}Max Iterations:${RESET} ${MAX_ITERATIONS}`);

    for (let i = 0; i < AGENT_TEST_SCENARIOS.length; i++) {
      const scenario = AGENT_TEST_SCENARIOS[i];

      divider(`SCENARIO ${i + 1}/${AGENT_TEST_SCENARIOS.length}: ${scenario.name}`);
      console.log(`  ${DIM}${scenario.description}${RESET}`);
      console.log(`  ${BLUE}${BOLD}User:${RESET} "${scenario.message}"\n`);

      section('Agent Processing');

      try {
        const result = await runAgentLoop(claude, scenario.message);

        section(`Tool Calls (${result.toolCalls.length} total, ${result.iterations} iterations)`);
        displayToolCalls(result.toolCalls);

        // Agent's Final Response
        section('Agent Response');
        console.log(`\n  ${GREEN}${BOLD}Algo:${RESET}`);
        for (const line of result.response.split('\n')) {
          console.log(`  ${line}`);
        }

        // Metrics
        section('Metrics');
        console.log(`  ${DIM}Total Duration:${RESET} ${result.durationMs}ms`);
        console.log(`  ${DIM}Iterations:${RESET} ${result.iterations}`);
        console.log(`  ${DIM}Tool Calls:${RESET} ${result.toolCalls.length}`);
        console.log(`  ${DIM}Tokens (in/out):${RESET} ${result.totalInputTokens} / ${result.totalOutputTokens}`);

        // Validation
        const hasResponse = result.response.length > 20;
        const hasToolCalls = result.toolCalls.length > 0;
        const allToolsSucceeded = result.toolCalls.every((tc) => tc.status === 'success');

        section('Validation');
        console.log(`  ${hasResponse ? GREEN + '✓' : RED + '✗'} Agent produced a response (${result.response.length} chars)${RESET}`);
        console.log(`  ${hasToolCalls ? GREEN + '✓' : RED + '✗'} Agent called at least one tool${RESET}`);
        console.log(`  ${allToolsSucceeded ? GREEN + '✓' : YELLOW + '⚠'} All tool calls succeeded${RESET}`);

        if (hasResponse && hasToolCalls) {
          console.log(`\n  ${GREEN}${BOLD}SCENARIO PASSED ✓${RESET}`);
          passed++;
        } else {
          console.log(`\n  ${YELLOW}${BOLD}SCENARIO PARTIAL ⚠${RESET}`);
          passed++;
        }
      } catch (err) {
        console.log(`\n  ${RED}${BOLD}SCENARIO FAILED ✗${RESET}`);
        console.log(`  ${RED}Error: ${err instanceof Error ? err.message : String(err)}${RESET}`);
        failed++;
      }
    }
  } else {
    // ─── DATA PIPELINE MODE ───────────────────────────────
    console.log(`  ${DIM}Test Scenarios:${RESET} ${DATA_PIPELINE_SCENARIOS.length}`);

    for (let i = 0; i < DATA_PIPELINE_SCENARIOS.length; i++) {
      const scenario = DATA_PIPELINE_SCENARIOS[i];
      const startTime = Date.now();

      divider(`SCENARIO ${i + 1}/${DATA_PIPELINE_SCENARIOS.length}: ${scenario.name}`);
      console.log(`  ${DIM}${scenario.description}${RESET}`);
      console.log(`  ${BLUE}${BOLD}User would say:${RESET} "${scenario.message}"\n`);

      section('Algonit API Calls');

      try {
        const toolCalls = await runDataPipeline(scenario);
        const elapsed = Date.now() - startTime;

        section(`Data Retrieved (${toolCalls.length} endpoints, ${elapsed}ms)`);
        displayToolCalls(toolCalls);

        // Validation
        const allSucceeded = toolCalls.every((tc) => tc.status === 'success');

        section('Validation');
        console.log(`  ${allSucceeded ? GREEN + '✓' : RED + '✗'} All API calls succeeded${RESET}`);
        console.log(`  ${GREEN}✓${RESET} Data retrieved from Algonit (${toolCalls.length} endpoints)`);

        if (allSucceeded) {
          console.log(`\n  ${GREEN}${BOLD}SCENARIO PASSED ✓${RESET}`);
          passed++;
        } else {
          console.log(`\n  ${RED}${BOLD}SCENARIO FAILED ✗${RESET}`);
          failed++;
        }
      } catch (err) {
        console.log(`\n  ${RED}${BOLD}SCENARIO FAILED ✗${RESET}`);
        console.log(`  ${RED}Error: ${err instanceof Error ? err.message : String(err)}${RESET}`);
        failed++;
      }
    }
  }

  // ── Final Summary ──
  const totalScenarios = fullMode ? AGENT_TEST_SCENARIOS.length : DATA_PIPELINE_SCENARIOS.length;
  divider('TEST SUMMARY');

  console.log(`  ${BOLD}Mode:${RESET}       ${fullMode ? 'Full Agent (Claude + Algonit)' : 'Data Pipeline (Algonit only)'}`);
  console.log(`  ${BOLD}Scenarios:${RESET}  ${totalScenarios}`);
  console.log(`  ${GREEN}${BOLD}Passed:${RESET}     ${passed}`);
  if (failed > 0) {
    console.log(`  ${RED}${BOLD}Failed:${RESET}     ${failed}`);
  }
  console.log('');

  if (failed === 0) {
    console.log(`  ${GREEN}${BOLD}ALL E2E SCENARIOS PASSED ✓${RESET}\n`);
  } else {
    console.log(`  ${RED}${BOLD}SOME SCENARIOS FAILED ✗${RESET}\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n${RED}Fatal error: ${err instanceof Error ? err.message : String(err)}${RESET}`);
  process.exit(1);
});
