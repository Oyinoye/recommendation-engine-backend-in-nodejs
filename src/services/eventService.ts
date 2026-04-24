import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../config/database';
import { insertEvent } from '../repositories/eventRepository';
import * as userContextRepository from '../repositories/userContextRepository';
import { publishUserEventMessage } from './pubsubService';
import {
  publishRealtimeEvent,
  cacheUserContext,
  getCachedUserContext,
  invalidateUserContextCache,
} from './cacheService';
import { routeRawEventToBigQuery } from './analyticsRoutingService';
import { logger } from '../utils/logger';

export type IngestEventInput = {
  event_id?: string;
  user_id: string;
  event_type: string;
  timestamp: string | Date;
  properties?: Record<string, unknown>;
  session_id?: string;
};

export class EventService {
  constructor(private readonly tenantId: string) {}

  async ingestEvent(input: IngestEventInput): Promise<{ id: string | null; status: 'accepted' | 'duplicate' }> {
    const eventId = input.event_id ?? uuidv4();
    const ts = new Date(input.timestamp);
    const properties = input.properties ?? {};

    const outcome = await withTransaction(async (client) => {
      const { inserted, rowId } = await insertEvent(client, {
        eventId,
        tenantId: this.tenantId,
        userId: input.user_id,
        eventType: input.event_type,
        timestamp: ts,
        properties,
        sessionId: input.session_id,
      });

      if (!inserted) {
        return { status: 'duplicate' as const, id: rowId };
      }

      return { status: 'accepted' as const, id: rowId };
    });

    if (outcome.status === 'duplicate') {
      logger.info('Duplicate event ignored after idempotent insert', { eventId, tenantId: this.tenantId });
      return { id: outcome.id, status: 'duplicate' };
    }

    await publishRealtimeEvent({
      id: eventId,
      tenant_id: this.tenantId,
      user_id: input.user_id,
      event_type: input.event_type,
      timestamp: ts.toISOString(),
      properties,
    });

    await publishUserEventMessage({
      event_id: eventId,
      tenant_id: this.tenantId,
      user_id: input.user_id,
      event_type: input.event_type,
      timestamp: ts.toISOString(),
      priority: input.event_type === 'purchase' ? 'high_priority' : 'normal',
    });

    void routeRawEventToBigQuery({
      event_id: eventId,
      tenant_id: this.tenantId,
      user_id: input.user_id,
      event_type: input.event_type,
      timestamp: ts.toISOString(),
      properties,
    });

    return { id: outcome.id, status: 'accepted' };
  }

  async getUserContextJson(userId: string): Promise<userContextRepository.UserContextRecord | null> {
    const cached = await getCachedUserContext(this.tenantId, userId);
    if (cached) {
      return cached as userContextRepository.UserContextRecord;
    }

    const db = await userContextRepository.getLatestUserContext(this.tenantId, userId);
    if (db) {
      await cacheUserContext(this.tenantId, userId, db);
    }
    return db;
  }

  async refreshContextCache(userId: string, context: userContextRepository.UserContextRecord): Promise<void> {
    await invalidateUserContextCache(this.tenantId, userId);
    await cacheUserContext(this.tenantId, userId, context);
  }
}
