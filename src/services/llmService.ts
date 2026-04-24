import { VertexAI } from '@google-cloud/vertexai';
import { env } from '../config/env';
import { logger, serializeError } from '../utils/logger';
import { withExponentialBackoff, isVertexRetryable } from '../utils/backoff';
import type { DbEventRow } from '../repositories/eventRepository';
import type { UserContextRecord } from '../repositories/userContextRepository';

function summarizeEvents(events: DbEventRow[]) {
  const types: Record<string, number> = {};
  for (const e of events) {
    types[e.event_type] = (types[e.event_type] ?? 0) + 1;
  }
  const breakdown = Object.entries(types)
    .map(([t, c]) => `- ${t}: ${c}`)
    .join('\n');
  const first = events[events.length - 1];
  const last = events[0];
  const days =
    first && last
      ? (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
  const recent = events
    .slice(0, 10)
    .map((e) => `[${e.event_type}] ${new Date(e.timestamp).toISOString()}`)
    .join('\n');
  return { breakdown, recent, days: days.toFixed(1) };
}

export function buildPrompt(events: DbEventRow[]): string {
  const s = summarizeEvents(events);
  return `You are an expert marketing analyst. Analyze user behavior and return ONLY valid JSON (no markdown).

USER EVENTS (most recent first): ${events.length} events, span ~${s.days} days.

BREAKDOWN:
${s.breakdown}

RECENT:
${s.recent}

Return JSON with keys:
persona (string), segment (one of: High Value|At Risk|Casual|New User|Loyal),
confidence_score (0-1), top_interests (string array max 5), engagement_score (0-10),
churn_risk (Low|Medium|High), recommendations (string array max 5), behavioral_traits (object).`;
}

export function parseModelJson(text: string): Partial<UserContextRecord> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model output');
  return JSON.parse(match[0]) as Partial<UserContextRecord>;
}

export function normalizeContext(parsed: Partial<UserContextRecord>): UserContextRecord {
  const churn = ['Low', 'Medium', 'High'].includes(String(parsed.churn_risk))
    ? String(parsed.churn_risk)
    : 'Medium';
  return {
    persona: parsed.persona || 'Unclassified user',
    segment: parsed.segment || 'Casual',
    confidence_score: Math.min(1, Math.max(0, Number(parsed.confidence_score ?? 0.5))),
    top_interests: (parsed.top_interests ?? ['General']).slice(0, 5),
    engagement_score: Math.min(10, Math.max(0, Number(parsed.engagement_score ?? 5))),
    churn_risk: churn,
    recommendations: (parsed.recommendations ?? []).slice(0, 5),
    behavioral_traits: (parsed.behavioral_traits as Record<string, unknown>) ?? {},
    generated_at: new Date().toISOString(),
  };
}

export function fallbackContextFromHeuristics(events: DbEventRow[]): UserContextRecord {
  const purchases = events.filter((e) => e.event_type === 'purchase');
  const totalSpent = purchases.reduce((sum, p) => sum + Number((p.properties as { amount?: number })?.amount ?? 0), 0);
  let segment = 'Casual';
  if (purchases.length > 10) segment = 'High Value';
  else if (purchases.length > 2) segment = 'Loyal';

  return {
    persona: `${segment} shopper`,
    segment,
    confidence_score: 0.35,
    top_interests: ['Shopping', 'Browsing'],
    engagement_score: Math.min(10, events.length / 5),
    churn_risk: purchases.length === 0 ? 'High' : 'Low',
    recommendations: ['Complete profile', 'Explore recommendations'],
    behavioral_traits: { purchase_count: purchases.length, total_spent: totalSpent },
    generated_at: new Date().toISOString(),
  };
}

export async function generateUserContextFromEvents(events: DbEventRow[]): Promise<UserContextRecord> {
  if (env.mockVertex) {
    return fallbackContextFromHeuristics(events);
  }

  const vertexAI = new VertexAI({
    project: env.gcp.projectId,
    location: env.gcp.vertexLocation,
  });

  const model = vertexAI.getGenerativeModel({
    model: env.gcp.vertexModel,
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  });

  const prompt = buildPrompt(events);

  const text = await withExponentialBackoff(
    async () => {
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const out = res.response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
      if (!out) throw new Error('Empty model response');
      return out;
    },
    { maxRetries: 5, isRetryable: isVertexRetryable, label: 'vertex.generateContent' },
  );

  try {
    const parsed = parseModelJson(text);
    return normalizeContext(parsed);
  } catch (e) {
    logger.warn('Failed to parse LLM JSON; using heuristic fallback', { error: serializeError(e) });
    return fallbackContextFromHeuristics(events);
  }
}
