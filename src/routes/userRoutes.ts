import { Router } from 'express';
import { EventService } from '../services/eventService';
import { listUserEvents } from '../repositories/eventRepository';

export const userRouter = Router();

userRouter.get('/:userId/events', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { userId } = req.params;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const rows = await listUserEvents(tenantId, userId, limit);
    res.json({
      events: rows.map((r) => ({
        id: r.event_id,
        event_type: r.event_type,
        user_id: userId,
        timestamp: new Date(r.timestamp).toISOString(),
        properties: r.properties ?? {},
        session_id: r.session_id,
      })),
    });
  } catch (e) {
    next(e);
  }
});

userRouter.get('/:userId/context', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const { userId } = req.params;
    const svc = new EventService(tenantId);
    const ctx = await svc.getUserContextJson(userId);
    if (!ctx) {
      res.status(404).json({ error: 'No context found for user' });
      return;
    }
    res.json(ctx);
  } catch (e) {
    next(e);
  }
});
