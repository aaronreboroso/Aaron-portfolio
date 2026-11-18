# Architecture and trust boundaries

## Request to application

The React client and Express API are served by one Node process. SQLite migrations run before accepting traffic. A project is a user-owned row and a virtual filesystem, not a publicly served directory. Project content cannot choose an OS path or run a shell command.

1. `POST /api/plans` validates a brief. The local analyzer or a configured provider proposes a bounded specification. An unparseable provider response is an error, not an invented successful app.
2. The user edits the plan. Only after approval does `POST /api/projects/build` compile it. Newline-delimited milestone events report actual compiler work. Files, initial memory, build report and version are committed together. An interrupted response without a receipt is ambiguous: check the project directory before retrying.
3. The client loads `/api/projects/:id/frame`. The server resolves local styles and scripts into an HTML document. It does **not** execute them. The sandboxed document asks its parent for narrowly scoped record operations.
4. The visual builder adjusts `app.config.json`; manual edits modify actual file rows. Supported refinements preserve all other source files. File saves reject stale base contents. An asynchronous refinement checks the saved revision before applying it.
5. A source restore creates a new checkpoint. It does not restore project records, instructions, workflows or deployment state. A ZIP contains editable source and a standalone server, **not a claim of deployment**.

## Model routing

`server/providers.mjs` contains the provider capability registry, transport adapters, preference policies, usage accounting and fallback orchestration. Models must be enabled on the user's own account. A provider's model ID is explicitly configurable; the suggested model names are not availability guarantees.

- **Automatic:** coding/refinement → advanced preference, planning → balanced, short workflow text → fast.
- **Fast:** prefer Gemini, then OpenAI, then Anthropic.
- **Balanced:** prefer OpenAI, then Anthropic, then Gemini.
- **Advanced:** prefer Anthropic, then OpenAI, then Gemini.
- **Override:** an explicitly selected configured provider is tried first. Local engine always stays local.

These are transparent routing policies, not benchmark claims. Only eligible configured providers participate. For transient network errors, provider unavailability and rate limits, try the next independently authorized connection **only if both configurations allow fallback**. Invalid credentials or invalid content do not trigger limitless retries. Each attempt has a deadline, bounded response size, usage record and monthly quota check. Token values are stored when returned by the provider; missing token metadata stays unknown. The UI receives actual fallback notices. A failed model call never silently becomes a successful AI build.

Add another official adapter by extending the registry, endpoint mapping/response normalization, routing policy and transport tests. There is intentionally no browser-controlled arbitrary provider base URL.

## Isolation and security

- Every project subroute, including frame, export, workflow and record routes, resolves its owner first. Foreign project IDs return 404. SQL statements bind parameters.
- Scrypt with random salts protects passwords. Session and high-entropy recovery tokens are stored as hashes. Password reset rotates the recovery key and revokes previous sessions. Recovery keys are **not** mailed or logged.
- Mutation routes require an application request header; cross-site browser writes are rejected. There is no permissive API CORS policy. Secure deployments use HTTP-only, Secure, partitioned cookies for embedded previews; ordinary local HTTP uses SameSite=Lax.
- A 32-byte master key encrypts integration secrets with fresh AES-GCM nonces. Credentials are never returned by state endpoints. Error logs contain status, route template and timestamp, not request bodies or provider payloads.
- Frames omit `allow-same-origin`, popup and top-navigation capabilities. `allow-forms` enables local submit handlers; a response CSP still denies network form actions, connections, external scripts and external resources. The parent checks the **exact source window**, request type, registered collection, record ID, size and per-frame request budget. It never exposes a generic API proxy. Frame CSP is enforced as an HTTP header, not only an editable meta element.
- Source inputs are bounded: up to 64 supported relative text files, 180 KB per file, 600 KB combined source, 12 collections per app, 20 fields per collection, 1,000 records per collection and 30 source versions. Text attachments are small context inputs, not arbitrary executable uploads.
- Generated browser JavaScript runs **only in the browser**. The server performs bounded parsing, JSON/schema checks and HTML assembly, never `eval`, user shell commands, package scripts or project-specific servers. A sandboxed iframe **is not a hard CPU/memory quota or a virtual machine**. For untrusted public marketplace code, add a separate-origin, resource-limited runner and review policy before allowing sharing.
- Admin-allowlisted webhook hosts must be trustworthy and secured against DNS/egress redirection. Enforce outbound network controls on the deployment too. Do not allow private service or cloud metadata hosts.

## Data model

`users`, `sessions`, `projects`, `project_files`, `project_versions`, `project_builds`, `project_memory`, `ai_providers`, `model_configurations`, `usage_records`, `integrations`, `workflows`, `workflow_executions`, `activity_logs`, `records`, `billing_events`, `billing_subscriptions` and `schema_migrations`.

SQLite uses foreign keys, WAL, owner indexes and transactional migrations. Each source snapshot is immutable and restored as a new version. AI credentials are distinguished from model configurations; usage is provider-attempt-level, not an estimate. Starter data is inserted **per user**, not shared publicly.

## Workflow semantics

Steps run in order from a saved definition. `{{key}}` substitutes a scalar input/variable, with no expression interpreter or arbitrary code. Conditions use string equality. Record actions validate against the selected collection. AI and webhook actions require configured adapters. A failure stops remaining steps and records an error; an unmet condition records a skipped result. Successful earlier actions are not implicitly rolled back. Retrying a workflow is an explicit user action and may repeat effects.

Manual tests can run with automatic triggers disabled. Record-created triggers run after the record is saved. A workflow's own record insert does not recursively trigger more workflows. Runs are request-bound, not a durable background queue; production scheduled jobs and exactly-once delivery require a job worker/outbox extension.

## Extension boundaries

The included runtime is a single-owner, record-oriented application generator. JSX and TypeScript are editable source formats; they are **not transpiled by the included preview**. Platform workflows, model routing, workspace accounts and billing are platform services, not automatically reproduced in exported apps. External databases, third-party auth, object storage, organization seats, subscription self-service and remote container builds are future adapters, not fictitious connections. For a larger installation, move to PostgreSQL, shared rate-limit storage, durable jobs and an isolated runner before horizontal scaling.
