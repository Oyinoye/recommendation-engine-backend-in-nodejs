Worrk in the backend folder. Use express with Typescript
Using the files and project in backend_reference folder, create a fully working project that meets all the criteria outlined below:

Event Ingestion API (High Concurrency): A high-throughput endpoint to receive user events (e.g. page_view, button_click, purchase). You must implement a strategy to handle bursts of traffic without dropping events by utilizing Gougle Cloud Pub/Sub asa mesage broker before writing to the database.
Data persistence: Store events in Google Cloud SQL (PostgreSQL) or Firestore. The schema must be optimized for fast retrieval by user_id and tenant_id. (Bonus: Route raw analytical data to BigQuery).
The "Context" Worker (Reliable Processing): An event-driven asynchronous task (utilizing Cloud Task, a Pub/Sub push subscription, or a worker deployed on Cloud Run) that:
Aggregates the last 50 events for a specific user.
Sends this event log to an LLM via Vertex AI (Gemini 1.5 Pro/Flash).
Generates a structured JSON profile for the user (e.g., "High-intent buyer," "At-risk of churn").
Implements robut retry logic with exponential backoff for LLM API rate limits or failures.
Strict Idempotency: Ensure that the same event ID cannot be processed twice, even if the client retries the request simultaneously.
Tenant Isolation: Every request must belong to a tenant_id to ensure data privacy. The database queries must inherenetly prevent crosss-tenant data leakage.

Deliverables
Github Repository.
AI_JOURNEY.md: Documentationof your collaboration with AI tools.
Infrastructure-as-Code (IaC): A docker-compose.yml file for local setup, or optionallly a Terraform snippet specifically configuring your GCP resorces (e.g. Cloud Run, Pub/Sub topics/subscriptions, Cloud SQL/Firestore setup).
Testing: Evidence of 80% code coverage on core busines logic, including integration tests for the API and worker.



In addition, do the following:
Implement full testing to the API such that event data can be gotten from a seeded event database and ingested as a stream to show full functionality.
The implementation should be fully tested to achieve 85% coverage.
