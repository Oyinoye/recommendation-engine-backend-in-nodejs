import { v4 as uuidv4 } from 'uuid';
import {
  buildPrompt,
  fallbackContextFromHeuristics,
  normalizeContext,
  parseModelJson,
} from '../src/services/llmService';
import type { DbEventRow } from '../src/repositories/eventRepository';

describe('llmService', () => {
  test('parseModelJson extracts JSON object', () => {
    const text = 'prefix {"persona":"A","segment":"Casual","confidence_score":0.2} suffix';
    const parsed = parseModelJson(text);
    expect(parsed.persona).toBe('A');
  });

  test('normalizeContext clamps fields', () => {
    const ctx = normalizeContext({
      persona: 'P',
      segment: 'Loyal',
      confidence_score: 2,
      top_interests: ['a', 'b', 'c', 'd', 'e', 'f'],
      engagement_score: 999,
      churn_risk: 'Nope',
      recommendations: ['1', '2', '3', '4', '5', '6'],
    });
    expect(ctx.confidence_score).toBe(1);
    expect(ctx.engagement_score).toBe(10);
    expect(ctx.top_interests.length).toBeLessThanOrEqual(5);
    expect(['Low', 'Medium', 'High']).toContain(ctx.churn_risk);
  });

  test('fallbackContextFromHeuristics uses purchases', () => {
    const events: DbEventRow[] = [
      {
        event_id: uuidv4(),
        event_type: 'purchase',
        timestamp: new Date(),
        properties: { amount: 10 },
        session_id: null,
      },
      {
        event_id: uuidv4(),
        event_type: 'page_view',
        timestamp: new Date(),
        properties: {},
        session_id: null,
      },
    ];
    const ctx = fallbackContextFromHeuristics(events);
    expect(ctx.segment).toBeTruthy();
    expect(ctx.generated_at).toBeTruthy();
  });

  test('buildPrompt includes counts', () => {
    const events: DbEventRow[] = Array.from({ length: 6 }).map((_, i) => ({
      event_id: uuidv4(),
      event_type: i % 2 === 0 ? 'page_view' : 'purchase',
      timestamp: new Date(Date.now() - i * 3600_000),
      properties: {},
      session_id: null,
    }));
    const p = buildPrompt(events);
    expect(p).toContain('USER EVENTS');
  });
});
