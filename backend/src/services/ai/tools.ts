/**
 * ════════════════════════════════════════════════════════════
 *  AGENT TOOL DEFINITIONS
 * ════════════════════════════════════════════════════════════
 *
 *  These tools are exposed to the Claude LLM as function-calling
 *  tools. The agent autonomously decides which tools to call,
 *  with what parameters, and in what order — based on the user's
 *  natural language request.
 *
 *  Each tool maps to an Algonit /api/algo/* endpoint.
 *
 *  Live tools (17): backed by real Algonit API
 *  Growth Copilot tools (3): proactive intelligence
 *  Deferred tools (5): mock-only, slated for next phase
 * ════════════════════════════════════════════════════════════
 */

export type AlgonitToolName =
  // Live query tools (15)
  | 'get_profile'
  | 'get_credits_balance'
  | 'get_posts'
  | 'list_campaigns'
  | 'get_campaign_performance'
  | 'get_email_campaign_stats'
  | 'get_market_radar'
  | 'get_dashboard_summary'
  | 'get_hot_leads'
  | 'get_buying_intent'
  | 'get_followup_tasks'
  | 'get_pipeline_metrics'
  | 'get_social_engagement'
  | 'get_leads'
  | 'get_insights'
  // Growth Copilot tools (3)
  | 'get_growth_summary'
  | 'get_recommendations'
  | 'accept_recommendation'
  // Live action tools (2)
  | 'pause_campaign'
  | 'resume_campaign'
  // Deferred action tools (5, mock-only)
  | 'create_campaign'
  | 'generate_content'
  | 'trigger_followup'
  | 'assign_task'
  | 'generate_report';

export const ALGONIT_TOOLS = [
  // ─── LIVE QUERY TOOLS ─────────────────────────────────────

  {
    name: 'get_profile',
    description:
      'Get the current user\'s Algonit profile including organization details and plan. Use this when the user asks about their account, profile, or organization info.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_credits_balance',
    description:
      'Get the current AI credits balance, usage, and recent transactions. Use this when the user asks about credits, remaining credits, or credit usage.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_posts',
    description:
      'Get social media posts with optional filtering by status and platform. Returns post content, platform, status, and scheduling info. Use this when the user asks about their posts, scheduled posts, or published content. For engagement metrics on individual posts, use get_insights instead (it returns top posts with likes, comments, shares). Combine with get_insights and get_social_engagement for a complete social media picture.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['published', 'scheduled', 'draft', 'failed'],
          description: 'Filter by post status',
        },
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin'],
          description: 'Filter by platform',
        },
      },
    },
  },

  {
    name: 'list_campaigns',
    description:
      'List all marketing campaigns with their current status and post counts. Use this when the user asks to see their campaigns, campaign list, or wants to find a specific campaign.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'draft', 'cancelled'],
          description: 'Filter by campaign status',
        },
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'email', 'whatsapp'],
          description: 'Filter by platform',
        },
      },
    },
  },

  {
    name: 'get_campaign_performance',
    description:
      'Get performance metrics for a specific campaign including impressions, clicks, conversions, spend, and ROI. Note: spend/ROI/conversions may be null if Meta Ads is not connected. Use this when the user asks about how a campaign is performing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'The campaign ID to get performance for. Use list_campaigns first to find the correct ID.',
        },
      },
      required: ['campaign_id'],
    },
  },

  {
    name: 'get_email_campaign_stats',
    description:
      'Get email DRIP campaign statistics: open rates, click rates, conversions. Use this when user asks about email campaigns, drip campaigns, or email performance.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_market_radar',
    description:
      'Get competitor intelligence signals from market radar. Use this when user asks about competitors, market trends, or competitive landscape.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_dashboard_summary',
    description:
      'Get a high-level snapshot of business metrics: active campaigns count, credit balance, recent posts count, and market radar alerts. This is a lightweight overview tool. For social media performance details, use get_insights + get_social_engagement instead. For growth intelligence, prefer get_growth_summary.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_hot_leads',
    description:
      'Get high-scoring leads (score >= 70) with urgency levels. Use this when the user asks about hot leads, best prospects, or high-value leads that need attention.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_buying_intent',
    description:
      'Get social buying intent signals — contacts showing purchase interest via social media activity. Use this when the user asks about buying signals, intent data, or prospects showing interest.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_followup_tasks',
    description:
      'Get contacts that are overdue for follow-up, with days since last contact and priority. Use this when the user asks about follow-ups needed, overdue contacts, or who needs to be reached out to.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_pipeline_metrics',
    description:
      'Get sales pipeline deals with weighted values and close urgency. Use this when user asks about pipeline, deals, deal stages, or sales funnel.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'get_social_engagement',
    description:
      'Get social media engagement metrics aggregated across all connected accounts per platform: likes, comments, shares, impressions, reach, CTR. Returns overall totals and per-platform breakdowns. Note: if the user manages multiple pages on one platform (e.g. 3 Instagram pages), this returns the combined total across all pages. For individual post performance, use get_insights. Always combine this with get_insights for the richest social media analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin'],
          description: 'Filter by specific platform. Omit for all platforms.',
        },
      },
    },
  },

  {
    name: 'get_leads',
    description:
      'Get all leads with stage and source breakdowns, average score, and hot lead flags. Use this when the user asks about leads, lead counts, leads from specific sources, or lead quality.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: 'Filter by lead source: social, email, whatsapp, website, referral',
        },
        stage: {
          type: 'string',
          enum: ['new', 'contacted', 'qualified', 'proposal', 'closed'],
          description: 'Filter by lead stage',
        },
      },
    },
  },

  {
    name: 'get_insights',
    description:
      'Your BEST tool for social media analytics. Returns: (1) AI-generated text insights about performance trends, (2) content type breakdowns with avg engagement per type (reels vs images vs articles etc.), (3) TOP POSTS with exact engagement metrics (likes, comments, shares, impressions per post), (4) campaign performance by platform. This is the ONLY tool that gives you per-post engagement numbers. Use it whenever the user asks about posts, social media, performance, what\'s working, analytics, or "how are my pages doing." Always use this alongside get_social_engagement for the most complete picture.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date_from: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format. Defaults to 30 days ago.',
        },
        date_to: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format. Defaults to today.',
        },
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin'],
          description: 'Filter insights to a specific platform. Omit for cross-platform analysis.',
        },
      },
    },
  },

  // ─── GROWTH COPILOT TOOLS ─────────────────────────────────

  {
    name: 'get_growth_summary',
    description:
      'Get executive growth summary with KPI changes, channel efficiency scores, top recommendations, and urgent items. Call this when the user asks "how are things going", "growth summary", "what should I focus on", "morning update", or any general performance question. This is your PRIMARY tool for proactive intelligence — always prefer this over get_dashboard_summary for general questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          enum: ['24h', '7d', '30d'],
          description: 'Analysis period. Defaults to 7d.',
        },
      },
    },
  },

  {
    name: 'get_recommendations',
    description:
      'Get AI-generated actionable recommendations for the business. Each recommendation includes a confidence score (0-100%), impact level, and can be executed with accept_recommendation. Call this when the user asks "what should I do", "any suggestions", "optimize my campaigns", or "what do you recommend".',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  {
    name: 'accept_recommendation',
    description:
      'Accept and queue a recommendation for execution. The user must confirm the action before it runs. Always show the recommendation details and ask for explicit confirmation before calling this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        recommendation_id: {
          type: 'string',
          description: 'The recommendation ID (rec_...) to accept and execute.',
        },
      },
      required: ['recommendation_id'],
    },
  },

  // ─── LIVE ACTION TOOLS ────────────────────────────────────

  {
    name: 'pause_campaign',
    description:
      'Pause an active marketing campaign. IMPORTANT: Always confirm with the user before calling this. Cannot pause completed or cancelled campaigns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'The ID of the campaign to pause. First use list_campaigns to find the correct ID.',
        },
      },
      required: ['campaign_id'],
    },
  },

  {
    name: 'resume_campaign',
    description:
      'Resume a paused marketing campaign. Confirm with user before executing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'The ID of the campaign to resume.',
        },
      },
      required: ['campaign_id'],
    },
  },

  // ─── DEFERRED ACTION TOOLS (mock-only, next phase) ────────

  {
    name: 'create_campaign',
    description:
      'Create a new marketing campaign. Confirm details with user before creating. Collect at minimum: campaign name, platform, and campaign type. (Note: This action is currently in preview mode.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'email', 'whatsapp'],
          description: 'Target platform',
        },
        type: {
          type: 'string',
          enum: ['social', 'email', 'ads', 'whatsapp'],
          description: 'Campaign type',
        },
        description: { type: 'string', description: 'Campaign description' },
        budget: { type: 'number', description: 'Campaign budget in USD' },
      },
      required: ['name', 'platform', 'type'],
    },
  },

  {
    name: 'generate_content',
    description:
      'Generate AI content for a post or campaign. Use when user asks to create or generate content, posts, or copy. (Note: This action is currently in preview mode.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['instagram', 'facebook', 'twitter', 'linkedin'],
          description: 'Target platform for the content',
        },
        topic: { type: 'string', description: 'Topic or subject for the content' },
        tone: {
          type: 'string',
          enum: ['professional', 'casual', 'formal', 'witty', 'inspirational'],
          description: 'Tone of the content',
        },
      },
      required: ['platform', 'topic'],
    },
  },

  {
    name: 'trigger_followup',
    description:
      'Trigger a follow-up action for a specific lead. Confirm with user before executing. (Note: This action is currently in preview mode.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: 'The lead ID to follow up with' },
        method: {
          type: 'string',
          enum: ['email', 'whatsapp', 'call', 'sms'],
          description: 'Follow-up method',
        },
      },
      required: ['lead_id'],
    },
  },

  {
    name: 'assign_task',
    description:
      'Assign a task to a team member. Use when user asks to assign work, delegate tasks, or assign follow-ups to someone. (Note: This action is currently in preview mode.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        assignee_id: { type: 'string', description: 'User ID of the assignee' },
        task_type: {
          type: 'string',
          enum: ['followup', 'call', 'review', 'content', 'other'],
          description: 'Type of task',
        },
        description: { type: 'string', description: 'Task description' },
        lead_id: { type: 'string', description: 'Associated lead ID if applicable' },
      },
      required: ['assignee_id', 'task_type', 'description'],
    },
  },

  {
    name: 'generate_report',
    description:
      'Generate a performance report. Use when user asks for a report, summary report, or performance report. (Note: This action is currently in preview mode.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        report_type: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'campaign', 'leads', 'custom'],
          description: 'Type of report',
        },
        date_from: { type: 'string', description: 'Report start date YYYY-MM-DD' },
        date_to: { type: 'string', description: 'Report end date YYYY-MM-DD' },
      },
      required: ['report_type', 'date_from', 'date_to'],
    },
  },
];
