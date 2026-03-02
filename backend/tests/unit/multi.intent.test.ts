import { describe, it, expect, vi } from 'vitest';
import { MultiIntentParser } from '../../src/services/ai/multi.intent.js';

// Mock LLM provider
const mockLLM = {
  createWithTools: vi.fn(),
  complete: vi.fn(),
};

describe('MultiIntentParser', () => {
  const parser = new MultiIntentParser(mockLLM as any);

  describe('isLikelySingleIntent (heuristic)', () => {
    it('should detect short messages as single intent', async () => {
      const result = await parser.parse('How are my campaigns doing?');
      expect(result.isMultiIntent).toBe(false);
    });

    it('should detect very short queries as single intent', async () => {
      const result = await parser.parse('Check credits');
      expect(result.isMultiIntent).toBe(false);
    });
  });

  describe('multi-intent detection', () => {
    it('should detect "and pause" as multi-intent', async () => {
      mockLLM.complete.mockResolvedValueOnce(JSON.stringify({
        is_multi_intent: true,
        segments: [
          { segment: 'How many leads this week', intent: 'query.leads.count', category: 'query', confidence: 0.93, entities: {} },
          { segment: 'pause the email drip', intent: 'action.campaign.pause', category: 'action', confidence: 0.91, entities: {} },
        ],
      }));

      const result = await parser.parse('How many leads this week, and pause the email drip campaign');
      expect(result.isMultiIntent).toBe(true);
      expect(result.segments).toHaveLength(2);
      expect(result.executionOrder[0].category).toBe('query'); // Queries first
      expect(result.executionOrder[1].category).toBe('action');
    });

    it('should handle LLM parse failure gracefully', async () => {
      mockLLM.complete.mockRejectedValueOnce(new Error('LLM timeout'));

      const result = await parser.parse('Do something and also something else please');
      expect(result.isMultiIntent).toBe(false);
    });
  });
});
