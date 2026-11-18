# Running ATROX in production

## Single-instance installation

1. Use Node.js 22.13 or later and a persistent local disk. The included architecture is single-instance, not a serverless filesystem or a multi-replica cluster.
2. Copy `.env.example` to `.env`. Generate a **stable 32-byte secret** with your secret manager or `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Supply the 64 hex characters as `ATROX_MASTER_KEY`. Do not commit it, expose it in frontend environment variables, or paste it into chat.
3. Run `npm ci`, `npm test`, `npm run build`, then `npm start`. Alternatively, set the same environment values and run `docker compose up --build -d`. The image runs as a non-root user; the compose stack mounts a persistent `/data` volume with CPU and memory limits.
4. Put an HTTPS reverse proxy in front of the app. Do not expose the development server to the public internet. Trust **one** controlled proxy hop; it must replace forwarded IP/protocol headers, not blindly trust client-supplied values. Restrict direct origin access. Preserve `Host`, set `X-Forwarded-Proto: https`, and disable buffering for the NDJSON build endpoint.
5. Set request/body/time limits at the proxy. Monitor `/healthz` and structured error logs. Keep app dependencies, Node and the container base image updated. Recheck with browser acceptance tests after upgrading.

The production server serves only `dist/` assets plus authorized API routes. `/api/projects/:id/frame` has a separate restrictive CSP so generated scripts can run in the browser without relaxing the application page's script policy. The public application does not set an iframe-blocking header that would break an authorized embedded preview.

## Environment

| Variable                                | Requirement / purpose                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `PORT`                                  | Default `5173`. Frontend and API share this port.                                                               |
| `ATROX_DATA_DIR`                        | Default `.data`; use a persistent private directory (`/data` in Docker).                                        |
| `ATROX_MASTER_KEY`                      | Required in production. Exactly 64 hex characters. Development can create a mode-0600 `vault.key`.              |
| `APP_ORIGIN`                            | Canonical HTTPS origin for billing return URLs.                                                                 |
| `COOKIE_SECURE`                         | Set `true` to force secure cookies in a proxied development environment. Production always uses secure cookies. |
| `ATROX_WEBHOOK_HOSTS`                   | Comma-separated, exact HTTPS hostnames for authorized workflow requests. Empty disables webhook destinations.   |
| `STRIPE_SECRET_KEY`                     | Server-side Stripe secret key. Optional unless billing is enabled.                                              |
| `STRIPE_WEBHOOK_SECRET`                 | Signing secret for this deployment's webhook endpoint.                                                          |
| `STRIPE_PRO_PRICE`, `STRIPE_TEAM_PRICE` | Stripe recurring price IDs matching the displayed plans.                                                        |

User AI keys are entered in **Integrations**, encrypted by the server, and scoped to the current owner. No `VITE_*` secret is used. For development-to-production migration, retain the original encryption key or disconnect/reconfigure integrations. Changing a master key without re-encryption makes existing ciphertext unreadable.

## Credentials and network access

| Service          | Official host                       | Required configuration                                            |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------- |
| OpenAI           | `api.openai.com`                    | Authorized key and model ID; Responses API access.                |
| Anthropic        | `api.anthropic.com`                 | Authorized API key and Claude model ID; Messages API access.      |
| Google Gemini    | `generativelanguage.googleapis.com` | Authorized Gemini API key and model ID.                           |
| Netlify          | `api.netlify.com`                   | Access token permitted to deploy to an explicit site UUID.        |
| Stripe           | `api.stripe.com`                    | Matching recurring prices, secret key and webhook signing secret. |
| Workflow webhook | Your configured host                | HTTPS, explicit hostname allowlist, trusted destination.          |

Connection tests query official model registries without generating a paid completion. “Configured” means credentials were saved; “Verified” means the provider accepted a real request. Restricted sandbox egress can prevent external calls even with a valid key. **Local generation remains functional.**

## Billing setup

The Free/Pro/Team plan definitions live in `shared/plans.mjs` and are shared with the public pricing view. Defaults are 10/50/200 projects and 100/1,500/5,000 monthly provider attempts. These are platform volume plans, not shared team seats. Configure Stripe recurring prices to match the advertised currency and amount, if you change these definitions.

Register `https://your-host/api/billing/webhook` for `customer.subscription.created`, `.updated`, and `.deleted`. Checkout binds the user ID through subscription metadata. A redirect alone does not grant access; signed subscription events do. Configure provider billing, taxes, invoices, cancellations and customer support in Stripe before selling subscriptions. If any required setting is absent, checkout is unavailable. No simulated card form or synthetic receipt exists.

## Backup and operations

Use SQLite's online backup mechanism, or stop the service for a consistent backup of the **entire** data directory including WAL state. Store the master key separately in your secret manager. Test restoration into a separate installation. Ordered migrations are applied transactionally at startup. Never place `.data`, `.env`, WAL files, exports containing user data, or vault keys under `public/` or `dist/`.

Periodic cleanup removes expired sessions and abandoned guest workspaces. Registered account data is not expired by the guest cleanup. The built-in limiter is process-local; add a shared limiter before scaling beyond one instance. Deploy structured monitoring and retention policies suitable for the sensitivity of your users' content.

## Exported applications

An exported project runs separately with Node 22.13+, `npm test`, then `npm start`. It binds to `127.0.0.1:3000` by default and stores its own data in `data/app.sqlite`. To expose it via HTTPS, set `HOST=0.0.0.0`, `PORT` and a strong `ATROX_APP_PASSWORD`. The standalone account name is `owner`; the included API uses HTTP Basic authentication behind TLS. The server refuses a non-loopback bind without a password. Add organization-specific authentication and abuse controls before opening a standalone app to a broad audience.

A Netlify upload is deliberately a different deployment target: browser-local storage, no Node process, no private preview records, no credentials, and no platform workflow runner. Always distinguish **preview**, **source export**, **deployment submitted**, and **deployment live**.
