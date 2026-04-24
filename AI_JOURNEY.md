# AI_JOURNEY.md

This document records how AI tools were used to implement the `backend/` service for the segment-to-context project.

## Goals

- Implement an Express + TypeScript backend aligned with `instruction_backend.md`.
- Mirror the architecture described in `backend_reference/` (API → Postgres → Pub/Sub → worker → Vertex), while fixing invalid SQL patterns found in the reference schema draft.
- Provide local Docker bring-up, optional Terraform for GCP primitives, and automated tests with high coverage on core logic.

## Collaboration workflow

1. **Specification extraction**: The assistant read `backend/instruction_backend.md` and the JavaScript `backend_reference/` sources to derive concrete API routes, data flow, and operational requirements (idempotency, tenant isolation, retries).
2. **Implementation**: The backend was authored as a new TypeScript project under `backend/` (not by mutating `backend_reference/`), keeping responsibilities split across repositories, services, middleware, routes, and workers.
3. **Verification**: The assistant installed dependencies, ran the TypeScript compiler, and executed Jest with coverage thresholds to validate behavior and catch integration issues early.

## Key decisions

- **Idempotency**: `event_id` is globally unique; duplicates short-circuit before Pub/Sub publish to avoid double-processing side effects.
- **Tenant isolation**: All reads/writes include `tenant_id` predicates; cross-tenant reuse of the same `event_id` is rejected with HTTP 409.
- **Local vs production**: `USE_MOCK_VERTEX` defaults to enabled for safe local development; disable it in production with real GCP credentials.
- **SSE**: `EventSource` cannot set headers; tenant is accepted via `X-Tenant-ID` for normal requests and `tenant_id` query string for `/events/stream` in production. In non-production environments, a `DEFAULT_TENANT_ID` fallback exists for demos.

## Prompting tips that worked well

- Ask for “Express + TypeScript” explicitly and require “strict idempotency” and “tenant isolation” as acceptance criteria.
- Provide a reference implementation folder and instruct the model to treat it as guidance while still correcting known issues (invalid SQL, missing realtime publish hooks, etc.).

Example prompts:
- Write tests to cover all busines logic, ensuring maximum coverage. Make sure all tests pass.

## Frontend

Example prompts:
- Go though the termial windows, find out why despite the fact that the below command works in the terminal, it does not work in the web app.fix the problem so that the the EventStream.tx component connects correclty and receives the live updates.
- It's supposed to be in real time but it's not updating in real time

## AI Agentic Tools used

- Cursor
- Codex


## Conclusion

- I was able to usse my expertise to work collaboratively with modern tools to achieve the desired results according to the specifications.
- The final solution is functional and scalable, meeting functional and non-functional requirements.
