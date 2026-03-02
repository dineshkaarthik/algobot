/**
 * ════════════════════════════════════════════════════════════
 *  FOLLOW-UP SUGGESTION ENGINE
 * ════════════════════════════════════════════════════════════
 *
 *  After every response, generates contextually relevant
 *  follow-up suggestions. This makes Algo feel proactive
 *  and intelligent — like a real chief of staff who
 *  anticipates what you'd want to know next.
 *
 *  Strategy:
 *  1. Rule-based suggestions (fast, no LLM call)
 *  2. Context-aware suggestions (considers conversation)
 *  3. Time-aware suggestions (morning vs evening)
 *  4. Role-aware suggestions (admin vs member)
 * ════════════════════════════════════════════════════════════
 */

import type { SuggestedAction } from '../../types/chat.types.js';

interface SuggestionContext {
  lastIntent: string;
  userRole: string;
  currentHour: number; // 0-23
  conversationLength: number;
  recentIntents: string[];
}

// ─── Rule-based suggestion mapping ───────────────────────

const INTENT_SUGGESTIONS: Record<string, SuggestedAction[]> = {
  'query.social.performance': [
    { label: 'Compare with last week', action: 'QUERY', params: { intent: 'query.analytics.comparison', time: 'last_week' } },
    { label: 'Content type insights', action: 'QUERY', params: { intent: 'query.analytics.insights' } },
    { label: 'Generate a report', action: 'ACTION', params: { intent: 'action.report.generate', type: 'social' } },
  ],

  'query.social.engagement': [
    { label: "What's working best?", action: 'QUERY', params: { intent: 'query.analytics.insights' } },
    { label: 'Generate more content', action: 'ACTION', params: { intent: 'action.content.generate' } },
    { label: 'View campaign list', action: 'QUERY', params: { intent: 'query.campaign.list' } },
  ],

  'query.analytics.insights': [
    { label: 'See detailed breakdown', action: 'QUERY', params: { intent: 'query.analytics.insights', detail: 'by_content_type' } },
    { label: 'Compare platforms', action: 'QUERY', params: { intent: 'query.social.performance', group: 'platform' } },
    { label: 'Show top posts', action: 'QUERY', params: { intent: 'query.social.engagement', detail: 'top_posts' } },
  ],

  'query.analytics.overview': [
    { label: 'Growth summary & recommendations', action: 'QUERY', params: { intent: 'query.growth.summary' } },
    { label: 'Hot leads', action: 'QUERY', params: { intent: 'query.leads.hot' } },
    { label: 'View pipeline', action: 'QUERY', params: { intent: 'query.revenue.pipeline' } },
  ],

  'query.growth.summary': [
    { label: 'Top recommendations', action: 'QUERY', params: { intent: 'query.growth.recommendations' } },
    { label: 'Compare channels', action: 'QUERY', params: { intent: 'query.growth.channels' } },
    { label: 'Urgent items only', action: 'QUERY', params: { intent: 'query.growth.urgent' } },
  ],

  'query.growth.recommendations': [
    { label: 'Execute top recommendation', action: 'ACTION', params: { intent: 'action.recommendation.accept' } },
    { label: 'Full growth summary', action: 'QUERY', params: { intent: 'query.growth.summary' } },
    { label: 'Show execution history', action: 'QUERY', params: { intent: 'query.growth.history' } },
  ],

  'query.leads.count': [
    { label: 'Show hot leads', action: 'QUERY', params: { intent: 'query.leads.hot' } },
    { label: 'Lead sources breakdown', action: 'QUERY', params: { intent: 'query.leads.source' } },
    { label: 'Any overdue follow-ups?', action: 'QUERY', params: { intent: 'query.leads.followup' } },
  ],

  'query.leads.hot': [
    { label: 'Trigger follow-up', action: 'ACTION', params: { intent: 'action.followup.trigger' } },
    { label: 'Assign to sales rep', action: 'ACTION', params: { intent: 'action.task.assign' } },
    { label: 'View pipeline', action: 'QUERY', params: { intent: 'query.revenue.pipeline' } },
  ],

  'query.leads.followup': [
    { label: 'Trigger follow-up now', action: 'ACTION', params: { intent: 'action.followup.trigger' } },
    { label: 'Show hot leads', action: 'QUERY', params: { intent: 'query.leads.hot' } },
    { label: 'Assign tasks', action: 'ACTION', params: { intent: 'action.task.assign' } },
  ],

  'query.credits.balance': [
    { label: 'Credit usage breakdown', action: 'QUERY', params: { intent: 'query.credits.balance', detail: 'breakdown' } },
    { label: 'Check campaigns', action: 'QUERY', params: { intent: 'query.campaign.list' } },
  ],

  'query.revenue.summary': [
    { label: 'View pipeline', action: 'QUERY', params: { intent: 'query.revenue.pipeline' } },
    { label: 'Top deals', action: 'QUERY', params: { intent: 'query.revenue.summary', detail: 'top_deals' } },
    { label: 'Generate revenue report', action: 'ACTION', params: { intent: 'action.report.generate', type: 'revenue' } },
  ],

  'query.email.drip': [
    { label: 'Email open rates', action: 'QUERY', params: { intent: 'query.email.performance' } },
    { label: 'Leads from email', action: 'QUERY', params: { intent: 'query.leads.count', source: 'email' } },
    { label: 'Create new drip', action: 'ACTION', params: { intent: 'action.campaign.create', type: 'drip' } },
  ],

  'action.campaign.pause': [
    { label: 'View other campaigns', action: 'QUERY', params: { intent: 'query.campaign.list' } },
    { label: 'Check performance', action: 'QUERY', params: { intent: 'query.campaign.status' } },
  ],

  'action.campaign.create': [
    { label: 'Generate content for it', action: 'ACTION', params: { intent: 'action.content.generate' } },
    { label: 'View all campaigns', action: 'QUERY', params: { intent: 'query.campaign.list' } },
  ],

  'action.content.generate': [
    { label: 'Schedule a post', action: 'ACTION', params: { intent: 'action.social.post' } },
    { label: 'Generate for another platform', action: 'ACTION', params: { intent: 'action.content.generate' } },
  ],

  'action.report.generate': [
    { label: 'Check revenue', action: 'QUERY', params: { intent: 'query.revenue.summary' } },
    { label: 'View leads', action: 'QUERY', params: { intent: 'query.leads.count' } },
  ],
};

// ─── Time-based suggestions ──────────────────────────────

const MORNING_SUGGESTIONS: SuggestedAction[] = [
  { label: 'Growth summary & recommendations', action: 'QUERY', params: { intent: 'query.growth.summary' } },
  { label: 'What should I focus on today?', action: 'QUERY', params: { intent: 'query.growth.recommendations' } },
  { label: 'Any urgent follow-ups?', action: 'QUERY', params: { intent: 'query.leads.followup', status: 'overdue' } },
];

const EVENING_SUGGESTIONS: SuggestedAction[] = [
  { label: "Today's summary", action: 'QUERY', params: { intent: 'query.analytics.overview', time: 'today' } },
  { label: 'Generate daily report', action: 'ACTION', params: { intent: 'action.report.generate', type: 'daily' } },
  { label: 'Check credits used today', action: 'QUERY', params: { intent: 'query.credits.balance' } },
];

// ─── Engine ──────────────────────────────────────────────

export class FollowupEngine {
  /**
   * Generate 2-3 contextually relevant follow-up suggestions
   */
  suggest(context: SuggestionContext): SuggestedAction[] {
    const suggestions: SuggestedAction[] = [];

    // 1. Intent-based suggestions (highest relevance)
    const intentSuggestions = INTENT_SUGGESTIONS[context.lastIntent];
    if (intentSuggestions) {
      suggestions.push(...intentSuggestions);
    }

    // 2. Time-based suggestions (if conversation just started)
    if (context.conversationLength <= 2) {
      if (context.currentHour >= 6 && context.currentHour <= 10) {
        suggestions.push(...MORNING_SUGGESTIONS);
      } else if (context.currentHour >= 17 && context.currentHour <= 22) {
        suggestions.push(...EVENING_SUGGESTIONS);
      }
    }

    // 3. Avoid suggesting what was already asked
    const filtered = suggestions.filter((s) => {
      const intentParam = (s.params as any)?.intent;
      return !intentParam || !context.recentIntents.includes(intentParam);
    });

    // 4. Deduplicate by label
    const seen = new Set<string>();
    const unique = filtered.filter((s) => {
      if (seen.has(s.label)) return false;
      seen.add(s.label);
      return true;
    });

    // Return top 3
    return unique.slice(0, 3);
  }

  /**
   * Generate greeting suggestions for a new conversation
   */
  greetingSuggestions(userRole: string, currentHour: number): SuggestedAction[] {
    const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

    const base: SuggestedAction[] = [
      { label: 'Growth summary', action: 'QUERY', params: { intent: 'query.growth.summary' } },
      { label: 'Any recommendations?', action: 'QUERY', params: { intent: 'query.growth.recommendations' } },
      { label: 'Any hot leads?', action: 'QUERY', params: { intent: 'query.leads.hot' } },
    ];

    if (userRole === 'admin' || userRole === 'manager') {
      base.push({ label: 'Revenue update', action: 'QUERY', params: { intent: 'query.revenue.summary' } });
    }

    return base.slice(0, 3);
  }
}
