# ATROX

**Describe it. Build it. Own it.**

ATROX is a full-stack software creation workspace. A natural-language brief becomes an **editable application specification**, then a real project with source files, a working record-management interface, an API, a database schema, and tests. You can use the local compiler without buying model credits or providing API keys.

The original red emblem and geometric wordmark are provided in `public/brand/` for light and dark surfaces. `public/atrox.svg` is the compact icon and favicon.

## Run it

Requires **Node.js 22.13+** (including `node:sqlite`) and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. The frontend and API share one origin. No external database, account, font CDN, or AI service is needed. The server binds to `0.0.0.0` for forwarded previews. A Node 22 experimental SQLite warning is expected.

- **`/`** — private creation dashboard. First use provisions a unique guest session with three **real, editable starter apps**: Orbit CRM, Stockroom, and Signal Analytics. Example records belong only to that guest.
- **`/welcome`** — public product overview, process, pricing, security and FAQ. This route does not provision a workspace.
- **`/signup`, `/signin`, `/reset`** — account entry points. Signup upgrades the current guest workspace in place. Account recovery uses an offline recovery key, **not email**.
- **`/healthz`** — process and database health.

Development data and the generated development encryption key live in `.data/`, which is ignored by Git. A guest is not a permanent account: sessions expire after 14 days, and expired, abandoned guest workspaces are cleaned up. Sign up to retain access across devices.

## Try one complete build

1. Enter **“Build a book catalog named Archive. Fields: title, author, price. Pages: reviews. Use dark mode.”** Or choose a prompt or template. Small text/Markdown/CSV/JSON attachments can provide context.
2. Click **Generate**. Review the name, objective, features and collections. Expand a collection’s field list to edit its schema.
3. Choose **Build application**. The server compiles the approved spec, validates the source and prepares a preview. Milestones are streamed from the actual compiler. **Build report** records completed checks; there is no simulated timer or fabricated test output.
4. Add an entry in **Preview**, reload, and find it again. Switch desktop/tablet/mobile widths. Preview data is persisted on the server and scoped to the owning project.
5. Ask **“Add a reporting page”**, edit a component in **Visual builder**, or modify a file in **Code**. Edits affect the source and create version snapshots. The editor supports project-wide text search, new files, syntax highlighting, selection-based assistance and `Ctrl/Cmd+S`.
6. Open **Memory**, **Versions**, or **Workflows**. For a first workflow, add a log step with `Hello {{name}}`, save it, and run it with `{"name":"Mika"}`. Read the recorded execution, not an illustrative timeline.
7. **Export ZIP**. Extract it, run `npm test`, then `npm start` in the exported directory. The exported Node application has **no third-party runtime dependencies**. Its SQLite records survive restarts independently of ATROX.

## What the engine supports

| Area              | Implemented behavior                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generation        | Deterministic, credential-free compiler for **record-based web apps**. Six starters plus custom collections, explicit fields, light/dark themes, layout and density. Optional AI plans conform to the same validated schema. |
| Project files     | Isolated virtual filesystems in SQLite. HTML/CSS/JavaScript client, `app.config.json`, standalone Node API, SQL schema, package metadata, README and tests.                                                                  |
| Preview           | Actual generated HTML, CSS and browser JavaScript in an opaque-origin sandbox. A narrowly scoped bridge supports CRUD in this project's collections.                                                                         |
| Visual builder    | Page tree, component palette, properties, text, colors, spacing, navigation layout, reorder/remove, immediate preview and explicit source save.                                                                              |
| Code workspace    | CodeMirror 6; editing and highlighting for HTML, CSS, JS, JSX, TypeScript, TSX and JSON. The **included executable runtime is ordinary HTML/CSS/JS**, not a remote React/TypeScript build farm.                              |
| Refinement        | Local changes to collections, charts, theme, accent, density and navigation; broader structured modifications through a configured provider. Updates the configuration without replacing custom source files.                |
| Memory & versions | Persistent instructions, requirements, architecture decisions, source checkpoints and activity history. Restore creates a **new** snapshot. Latest 30 snapshots per project. Record data is not rolled back with source.     |
| Automation        | Manual and record-created triggers. Variables, exact-match conditions, logs, record creation, authorized AI steps and allowlisted API requests. Enabled triggers and manual tests have persistent execution logs.            |
| Authentication    | Scrypt passwords, opaque hashed session tokens, guest upgrade, signin/signout, recovery-key password reset with session revocation.                                                                                          |
| Usage & billing   | UTC monthly quotas, provider attempt history and actual token metadata when available. Free/Pro/Team volume definitions. Stripe Checkout and signed subscription webhooks are disabled without configuration.                |
| Ownership         | Downloadable source ZIP, revision history, portable app configuration, optional explicit Netlify frontend deployment. No platform provider secrets or private preview records in exports.                                    |

**Briefs and prose requirements are not executable features.** Only supported collections, fields, components, styles and configured actions are compiled. The local engine does not pretend to implement arbitrary integrations, multiplayer applications, research or general-purpose software from a sentence. Provider-based code suggestions require review and manual application.

## Configure external services

Open **Integrations**. Nothing external is marked verified until a real provider request succeeds. Raw credentials are write-only from the UI, encrypted with AES-256-GCM on the server and never included in project files.

- **AI:** configure an OpenAI, Anthropic or Gemini key and an available model ID. The adapters use the official Responses, Messages and GenerateContent APIs. Record model configuration and opt in to fallback. Select **Local engine** to keep the request off external providers. See [routing and permissions](docs/architecture.md#model-routing).
- **Netlify:** a scoped access token and a site UUID. **Deploy** requires an explicit project-name confirmation and submits a real ZIP to the selected site. This publishes a **static frontend with browser-local data**, not the embedded Node backend. A provider acceptance receipt is not proof a deployment has finished.
- **Webhook:** the administrator must set `ATROX_WEBHOOK_HOSTS` to exact, trusted hostnames first. A user then supplies an HTTPS destination in Integrations. Workflow requests POST a JSON message; redirects and arbitrary hosts are rejected.
- **Stripe:** set all Stripe variables and `APP_ORIGIN`, configure matching recurring prices, and register `/api/billing/webhook`. Only verified subscription events update plan access. No card details pass through ATROX.

These integrations require **both credentials and outbound network access to their official services**. No paid API call, payment or public deployment is needed to use or test the foundation.

## Verify

```sh
npm run check       # TypeScript
npm run build       # Type check + optimized Vite production assets
npm test            # Isolated API, security, persistence, compiler and export tests

# A real Chromium or Chrome executable is required for browser acceptance tests.
CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

The browser suite starts a disposable production-build server and in-memory database. It covers prompt → plan → build, CRUD persistence inside the sandbox, refinement, visual editing, CodeMirror file creation, checkpoints, workflow execution, ZIP download, signup, command search and mobile navigation. The export test boots a **trusted fixture** in a temporary directory and checks its independent API after a restart. Provider failure/fallback tests use an explicit test transport, never fake production responses.

## Deploy

Use the included **Dockerfile / `compose.yaml`**, or run `npm run build && npm start` behind an HTTPS reverse proxy with persistent storage. **Production requires `ATROX_MASTER_KEY`.** See [deployment, configuration and backups](docs/deployment.md) before exposing the service publicly.

## Repository map

```
src/                  React + TypeScript application and responsive design system
  components/         Brand, navigation, command palette, composer, shared UI
  pages/              Dashboard, creation flow, studio, library, settings, landing
  workspace/          Preview bridge, CodeMirror editor, visual & workflow builders
  lib/                Typed API client, navigation, workspace state
shared/catalog.mjs    Starter schemas and local request analysis
server/               Express API, authentication, vault, router, billing, workflows
  migrations/         Ordered transactional SQLite migrations
  runtime/            Trusted source templates shipped in the generated apps
public/art/           Original creation-core render and mathematical project covers
scripts/art.py        Reproducible wireframe cover generation
tests/               Server, export and browser acceptance suites
```

The brief’s advanced areas are bounded deliberately: no arbitrary server-side code execution, unrestricted package installation, hard-CPU-isolated remote builds, hosted research, multi-user team collaboration, or fake payment processing. Platform workflows run in ATROX, not in the exported standalone server. See [architecture and boundaries](docs/architecture.md).
