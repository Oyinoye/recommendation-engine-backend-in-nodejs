import { z } from 'zod';

export const eventTypeSchema = z.enum(['page_view', 'button_click', 'purchase', 'signup', 'login']);

export const ingestEventSchema = z.object({
  event_id: z.string().uuid().optional(),
  user_id: z.string().min(1).max(255),
  event_type: eventTypeSchema,
  timestamp: z.coerce.date().default(() => new Date()),
  properties: z.record(z.string(), z.unknown()).default({}),
  session_id: z.string().max(255).optional(),
});

export const batchSchema = z.object({
  events: z.array(ingestEventSchema).min(1).max(1000),
});

export type IngestEventBody = z.infer<typeof ingestEventSchema>;
