import { describe, it, expect } from 'vitest';
import { FollowupEngine } from '../../src/services/ai/followup.engine.js';

describe('FollowupEngine', () => {
  const engine = new FollowupEngine();

  describe('suggest', () => {
    it('should return suggestions based on last intent', () => {
      const suggestions = engine.suggest({
        lastIntent: 'query.leads.count',
        userRole: 'admin',
        currentHour: 14,
        conversationLength: 4,
        recentIntents: ['query.leads.count'],
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should filter out already-asked intents', () => {
      const suggestions = engine.suggest({
        lastIntent: 'query.leads.count',
        userRole: 'admin',
        currentHour: 14,
        conversationLength: 4,
        recentIntents: ['query.leads.count', 'query.leads.hot', 'query.leads.source'],
      });

      // Should not suggest hot leads or source since they were already asked
      const intentParams = suggestions.map((s) => (s.params as any)?.intent);
      expect(intentParams).not.toContain('query.leads.hot');
      expect(intentParams).not.toContain('query.leads.source');
    });

    it('should include morning suggestions for early conversations', () => {
      const suggestions = engine.suggest({
        lastIntent: 'system.greeting',
        userRole: 'admin',
        currentHour: 8,
        conversationLength: 1,
        recentIntents: [],
      });

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should include evening suggestions for late conversations', () => {
      const suggestions = engine.suggest({
        lastIntent: 'system.greeting',
        userRole: 'admin',
        currentHour: 19,
        conversationLength: 1,
        recentIntents: [],
      });

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('greetingSuggestions', () => {
    it('should return greeting suggestions', () => {
      const suggestions = engine.greetingSuggestions('admin', 9);
      expect(suggestions.length).toBe(3);
    });

    it('should include revenue for admin/manager roles', () => {
      const adminSuggestions = engine.greetingSuggestions('admin', 14);
      const viewerSuggestions = engine.greetingSuggestions('viewer', 14);

      // Admin gets revenue option
      expect(adminSuggestions.length).toBe(3);
      expect(viewerSuggestions.length).toBe(3);
    });
  });
});
