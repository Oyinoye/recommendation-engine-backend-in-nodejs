# Segment-to-Context Backend

This backend powers a real-time event ingestion and AI context generation system. Its job is to accept user behavior events, store them durably, stream them live to the frontend, and generate AI-assisted user personas and context in the background.

At a high level, the system turns raw interaction data such as page views, signups, button clicks, logins, and purchases into:

- a live event stream for the dashboard
- persisted event history in Postgres
- cached and queryable user context records
- background AI-generated persona updates

This implementation is built with:

- Node.js
- Express
- TypeScript
- PostgreSQL
- Redis
- Google Pub/Sub
- Vertex AI with a local heuristic fallback for development

---

## Purpose

The project is designed to solve two connected problems:

1. Ingest product analytics events reliably and in near real time.
2. Transform those events into useful user-level marketing and product intelligence.

That means the backend is not only an API layer. It is also:

- a realtime event delivery layer for the frontend via SSE
- a durable event store
- an asynchronous worker pipeline
- a caching and coordination layer
- an AI context-generation pipeline

---

## System Overview

The frontend talks to the API over HTTP and SSE. The API persists events first, then fans them out to Redis for realtime delivery and Pub/Sub for asynchronous processing. A separate worker consumes the queued jobs, loads recent events for a user, generates context, writes the result back to Postgres, and refreshes Redis cache entries.

This is the main architecture diagram from the system design:

![Segment architecture diagram](./diagrams/segment_architecture.drawio.png)

Editable source:

- `backend/diagrams/architecture.drawio`

---

## Core Components

### API service

The Express API is responsible for:

- validating incoming events
- resolving tenant identity
- enforcing rate limits
- persisting accepted events
- exposing the SSE stream
- returning user event history and generated context

Important routes:

- `POST /api/v1/events`
- `POST /api/v1/events/batch`
- `GET /api/v1/events/stream`
- `GET /api/v1/users/:userId/events`
- `GET /api/v1/users/:userId/context`

The same routes are also exposed through `/api/...` aliases for frontend convenience.

### PostgreSQL

Postgres is the source of truth for:

- `events`
- `user_contexts`
- `processing_audit`

Important design properties:

- `event_id` is globally unique for idempotent event ingestion
- event queries are indexed by `(tenant_id, user_id, timestamp)`
- `user_contexts` is unique per `(tenant_id, user_id)`

### Redis

Redis is used for fast runtime coordination:

- publishing `realtime_events` for SSE
- publishing `context_updates`
- caching user context as `ctx:{tenant}:{user}`
- tracking cooldown/aggregation state as `agg:{tenant}:{user}`
- acquiring distributed locks as `lock:{tenant}:{user}`

### Pub/Sub worker pipeline

Accepted events publish async jobs into Pub/Sub. A separate worker process consumes those messages and generates updated user context without blocking the request-response path.

This separation is important because LLM-based context generation is slower and more failure-prone than normal API reads and writes.

### LLM/context generation layer

The worker builds a prompt from recent user events and sends that to Vertex AI, or falls back to a heuristic generator in development or failure scenarios.

Generated output is normalized into a structured context object containing fields such as:

- `persona`
- `segment`
- `confidence_score`
- `top_interests`
- `engagement_score`
- `churn_risk`
- `recommendations`

---

## Data Flow

### Ingestion and realtime delivery

```text
Client
  -> Express API
  -> EventService.ingestEvent()
  -> PostgreSQL write
  -> Redis publish realtime_events
  -> Pub/Sub publish user-events
  -> SSE stream delivers live updates to frontend
```

### Context generation

```text
Pub/Sub job
  -> Context worker
  -> Redis per-user lock
  -> Load recent events from PostgreSQL
  -> Generate user context with Vertex AI / fallback
  -> UPSERT user_contexts
  -> Refresh Redis cache
  -> Publish context_updates
```

---

## Important Design Decisions

### Persist-first ingestion

One of the most important architectural choices is that events are persisted to Postgres before they are published to Redis and Pub/Sub.

That means:

- accepted events are durable immediately
- duplicate `event_id`s can be handled cleanly
- worker jobs only run for events that are already stored

Tradeoff:

- Postgres remains on the hot ingest path
- this is simpler and safer than a queue-first design, but less burst-resistant than a full outbox or write-behind architecture

### Eventual consistency for generated context

User context is derived state, not primary state.

So the system guarantees:

- raw events are stored first
- generated user context appears shortly after, not necessarily immediately

If the worker fails mid-process:

- the event is still stored
- the prior good cached or persisted context remains intact
- the user may temporarily have stale or missing derived context until retry or a later event

### Multi-tenant handling

Tenant identity is resolved from:

- `X-Tenant-ID` header
- or `tenant_id` query parameter

In non-production, the backend can fall back to `DEFAULT_TENANT_ID` for demo convenience. In production, tenant identity is required.

---

## Scaling Notes

The system is designed so the API and worker can scale independently.

### API scaling

- stateless Express service
- horizontally scalable behind shared Postgres and Redis
- SSE clients are long-lived, so concurrency settings need to be tuned carefully

### Worker scaling

- separate worker process
- horizontally scalable through Pub/Sub backlog distribution
- Redis per-user locks reduce duplicate concurrent context generation

This model maps naturally to Cloud Run for the API and the worker as separate services.

---

## Known Query and Performance Considerations

The implementation avoids classic ORM-style N+1 query issues because it uses explicit repository queries instead of lazy relational graph loading. That said, there are still scaling patterns to watch:

- many frontend requests for many users can become an application-level N+1 pattern
- batch ingestion currently loops through events and processes them per event
- repeated worker jobs for the same user can still generate extra reads, though locks and cooldowns reduce this

The main mitigations already present are:

- indexed event lookups
- Redis-backed context caching
- per-user worker locking
- cooldown windows for repeated processing

---

## Running Locally

### API

```bash
npm install
npm run dev
```

### Worker

In a second terminal:

```bash
npm run worker
```

### Full local stack via Docker

```bash
docker compose up --build
```

This starts:

- Postgres
- Redis
- Pub/Sub emulator
- API
- worker

---

## Important Environment Variables

Some of the most important settings are:

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `PUBSUB_TOPIC`, `PUBSUB_SUBSCRIPTION`
- `PUBSUB_EMULATOR_HOST`
- `USE_MOCK_VERTEX`
- `MOCK_PUBSUB`
- `DEFAULT_TENANT_ID`
- `FRONTEND_URL`

See:

- `backend/.env.example`

---

## Where To Read More

Use this README as the project entry point, then go deeper here:

- [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md): architecture, scaling, verification answers, consistency discussion
- [BACKEND.md](./BACKEND.md): full technical walkthrough, routes, services, repositories, local usage details
- [AI_JOURNEY.md](./AI_JOURNEY.md): short narrative of the development process

---

## Summary

This backend is a realtime analytics-to-context pipeline:

- it accepts product/user events
- stores them durably
- streams them live to the dashboard
- processes them asynchronously
- generates structured user context for downstream product and marketing use

Its main strengths are clear separation of concerns, durable ingest, good local development ergonomics, and a straightforward path to horizontal scaling. Its main tradeoff is that the database remains on the write path and derived context is eventually consistent rather than synchronous.
