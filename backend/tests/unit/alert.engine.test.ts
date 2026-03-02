import { describe, it, expect, vi } from 'vitest';

describe('Alert Rules', () => {
  // Test the alert rule logic directly

  describe('hot_lead rule', () => {
    const check = (data: any) => {
      const uncontacted = data.hotLeads?.hot_leads?.filter((l: any) => !l.contacted) || [];
      return uncontacted.length > 0 ? uncontacted[0] : null;
    };

    it('should trigger for uncontacted hot leads', () => {
      const result = check({
        hotLeads: {
          hot_leads: [
            { name: 'Sarah', company: 'TechCorp', score: 92, contacted: false },
          ],
        },
      });
      expect(result).not.toBeNull();
      expect(result.name).toBe('Sarah');
    });

    it('should not trigger when all leads are contacted', () => {
      const result = check({
        hotLeads: {
          hot_leads: [
            { name: 'Sarah', company: 'TechCorp', score: 92, contacted: true },
          ],
        },
      });
      expect(result).toBeNull();
    });

    it('should not trigger with no hot leads', () => {
      const result = check({ hotLeads: { hot_leads: [] } });
      expect(result).toBeNull();
    });
  });

  describe('credit_low rule', () => {
    const check = (data: any, thresholds: any) => {
      const remaining = data.credits?.remaining_credits || Infinity;
      return remaining <= (thresholds.credit_threshold || 500);
    };

    it('should trigger when credits below threshold', () => {
      expect(check(
        { credits: { remaining_credits: 200 } },
        { credit_threshold: 500 },
      )).toBe(true);
    });

    it('should not trigger when credits above threshold', () => {
      expect(check(
        { credits: { remaining_credits: 4500 } },
        { credit_threshold: 500 },
      )).toBe(false);
    });

    it('should use custom threshold', () => {
      expect(check(
        { credits: { remaining_credits: 800 } },
        { credit_threshold: 1000 },
      )).toBe(true);
    });
  });

  describe('budget_alert rule', () => {
    const check = (data: any, thresholds: any) => {
      const campaigns = data.campaigns?.campaigns || [];
      return campaigns.filter((c: any) => {
        if (!c.budget || c.budget === 0) return false;
        const spentPct = (c.spent / c.budget) * 100;
        return spentPct >= (thresholds.budget_threshold_pct || 80);
      });
    };

    it('should trigger when campaign exceeds budget threshold', () => {
      const result = check(
        { campaigns: { campaigns: [{ name: 'Test', budget: 1000, spent: 850 }] } },
        { budget_threshold_pct: 80 },
      );
      expect(result).toHaveLength(1);
    });

    it('should not trigger when under threshold', () => {
      const result = check(
        { campaigns: { campaigns: [{ name: 'Test', budget: 1000, spent: 500 }] } },
        { budget_threshold_pct: 80 },
      );
      expect(result).toHaveLength(0);
    });

    it('should skip campaigns with zero budget', () => {
      const result = check(
        { campaigns: { campaigns: [{ name: 'Test', budget: 0, spent: 100 }] } },
        { budget_threshold_pct: 80 },
      );
      expect(result).toHaveLength(0);
    });
  });

  describe('followup_overdue rule', () => {
    const check = (data: any) => {
      return (data.followups?.overdue_count || 0) > 0;
    };

    it('should trigger when overdue tasks exist', () => {
      expect(check({ followups: { overdue_count: 3 } })).toBe(true);
    });

    it('should not trigger when no overdue tasks', () => {
      expect(check({ followups: { overdue_count: 0 } })).toBe(false);
    });
  });
});
