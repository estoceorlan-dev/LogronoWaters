# Deployment · LogronoWaters

Vercel hosts the LogronoWaters frontend and its authenticated API. Neon provides Postgres and managed Auth. This guide covers environment configuration, schema setup, publishing, and operations. For system design, see [Architecture](ARCHITECTURE.md); for business workflows, see [Project details](PROJECT.md).

## Production deployment

| Setting                 | Current deployment                                             |
| ----------------------- | -------------------------------------------------------------- |
| Application             | [logrono-waters.vercel.app](https://logrono-waters.vercel.app) |
| Vercel project          | `logrono-waters`                                               |
| Source                  | `estoceorlan-dev/LogronoWaters`, branch `main`                 |
| Runtime and API region  | Node.js 22, Singapore (`sin1`)                                 |
| Neon project and branch | `logrono-waters`, branch `production`                          |

Pushes to `main` trigger Vercel deployments. Production environment variables are stored in Vercel, and the application origin is registered in the production branch's Neon Auth trusted domains. Local credentials, verification passwords, and database files are excluded from Git and CLI deployment uploads.

## 1. Create or select the Neon project

Use the intended LogronoWaters project in your Neon account. If there is none, create an AWS project, preferably Singapore (`aws-ap-southeast-1`) to match the API's `sin1` region in `vercel.json`. Do not reuse a database belonging to another app. Every new project includes Postgres.

Use separate development/preview and production branches. When changing an existing production schema, first apply and test migrations on a child branch. Keep preview deployments pointed to their own branch, including their own Auth URLs and staff access settings.

In Neon, copy both connection strings for the intended branch/database:

- Pooled connection (`-pooler` host): `DATABASE_URL` for the application.
- Direct connection (without `-pooler`): `DATABASE_URL_UNPOOLED` for migrations.

Retain TLS parameters supplied by Neon, including `sslmode=require`. Never disable certificate verification.

## 2. Enable managed Neon Auth

Enable managed Better Auth on the same branch in the Neon Console. Alternatively, link the intended project using the Neon CLI, review `neon.ts` (`auth: true`), and apply it with `neon deploy`. Do not run both provisioning approaches unnecessarily. Managed Auth requires an AWS project without IP Allow or Private Networking; keep existing network restrictions in place and resolve identity separately if those protections are required.

Configure email/password sign-in, **require email verification at signup**, and enable the Email OTP flow for verification codes. Configure custom SMTP for production verification and password-reset delivery. Configure a sensible password policy and Auth rate limits in the Neon Console. Add exact frontend origins (scheme and hostname, no trailing slash) to trusted domains:

- Your development URL, such as `http://localhost:5173`.
- The final Vercel production URL and custom domain, if used.
- Each preview URL that needs login, on its corresponding preview branch.

Copy the exact Auth Base URL, including its database/Auth path, to `NEON_AUTH_BASE_URL`. Vite uses that public URL automatically when `VITE_NEON_AUTH_URL` is unset, including after `neon deploy` pulls the branch environment. An explicit `VITE_NEON_AUTH_URL` overrides it and must point to the same branch. Copy the JWKS URL to `NEON_AUTH_JWKS_URL`; it normally ends with `/auth/.well-known/jwks.json`. The API verifies EdDSA signatures plus the Auth origin as both issuer and audience.

No Better Auth database migrations are needed: Neon manages its own `neon_auth` schema. The app migration creates only station tables.

## 3. Configure environment variables

Copy `.env.example` to an ignored `.env.local` for local setup. Use actual values, then add the application variables to the intended Vercel project's Production environment. Add separate values to Preview when preview branches are ready.

| Variable                | Required where               | Description                                                    |
| ----------------------- | ---------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`          | Vercel runtime; local API    | Pooled Postgres URL; server only                               |
| `DATABASE_URL_UNPOOLED` | Migration environment        | Direct URL; not needed by the deployed app                     |
| `NEON_AUTH_BASE_URL`    | Vercel runtime; local API    | Exact branch Auth URL including its path                       |
| `NEON_AUTH_JWKS_URL`    | Vercel runtime; local API    | Branch JWKS endpoint (optional if it follows the default path) |
| `VITE_NEON_AUTH_URL`    | Optional build-time override | Public Auth URL; defaults to `NEON_AUTH_BASE_URL`              |
| `ADMIN_EMAILS`          | Vercel runtime; local API    | Comma-separated verified owner/admin emails                    |
| `STAFF_EMAILS`          | Vercel runtime; local API    | Comma-separated verified staff emails; may be empty            |

Only the public Auth URL uses a `VITE_` prefix. Database URLs, passwords, and access lists must never have that prefix or be committed. An empty admin/staff list grants no access. Any verified Auth user may exist, but only the explicitly listed accounts can read or change station data. Administrators control settings, supplier changes, inventory thresholds, customer archival/restoration, and reversing paid status. Staff can record customers, orders, payments, inventory movements, production, and maintenance.

Redeploy after changing Vercel environment variables. The frontend's public Auth URL is embedded at build time, so changing either its explicit override or fallback requires a rebuild. Removing a staff email takes effect on the next request after the updated runtime is deployed. Sign-out clears the Auth session; already-issued JWTs can remain valid until their short expiration.

## 4. Apply the schema

From the checkout, with Node.js 22 and the intended branch's direct URL in `.env.local` or the process environment:

```sh
npm ci
npm run db:migrate
```

The migration runner uses an advisory lock, transactions, and a migration history with checksums. Re-running it skips applied migrations. It rejects pooled migration URLs. Keep applied SQL files unchanged and add a new numbered migration for future changes. **Migrations do not run in Vercel's build**, preventing preview builds from changing production accidentally.

The initial database contains only station defaults and three stock categories at zero quantity. No sample customers, orders, staff passwords, or fake revenue are inserted.

## 5. Configure Vercel

Import this repository into the correct Vercel account/project:

| Setting          | Value                                         |
| ---------------- | --------------------------------------------- |
| Framework        | Vite                                          |
| Root directory   | Repository root                               |
| Install command  | `npm ci`                                      |
| Build command    | `npm run build`                               |
| Output directory | `dist`                                        |
| Node.js          | 22.x                                          |
| Function region  | Singapore (`sin1`), declared in `vercel.json` |

Vercel discovers `api/handler.js` as a Node function. `vercel.json` routes `/api/*` to it and preserves client navigation at `/orders`, `/customers`, `/inventory`, `/settings`, and `/auth/reset-password`. Database access remains in server code. The shared `pg` pool uses Vercel's pool lifecycle integration.

Before publishing, run:

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

GitHub Actions also runs these checks on pull requests and pushes to `main`/`master`, without production credentials. Browser checks use a disposable database and local test identity service; **they do not verify your live Neon Auth configuration or email delivery**.

## 6. Verify the deployed app

1. Open `/api/health`; expect `{"status":"ok"}`. This checks function liveness, not database connectivity.
2. Request `/api/orders` without a bearer token; expect HTTP 401 and no business data.
3. Register your `ADMIN_EMAILS` account, complete email verification, sign out, sign in again, and reload. Confirm access to Settings.
4. Register an email outside both lists; confirm it receives no station access even after email verification.
5. Test password reset and actual verification/reset emails from your production SMTP provider.
6. Add an actual customer, record opening stock, create a pickup/delivery order, progress fulfillment, and mark payment collected. Confirm stock and dashboard values after a reload and in another browser.
7. Test cancellation on an unpaid order and confirm stock is restored once. Check refill production, low-stock alerts, suppliers, maintenance, CSV export, and the printable order summary.
8. Open `/orders` directly and reload on desktop and mobile. Check Auth behavior in your supported browsers, including Safari; cross-domain cookie restrictions may require a custom Auth domain or a supported reverse-proxy setup.
9. Confirm the app's production env values use the production branch, and preview deployments use the preview branch.

Complete these live checks after credentials, domains, and SMTP are configured. Local tests and frontend builds do not verify production service configuration.

For an opt-in local check against the linked Neon branch, start `npm run dev` and run `npm run verify:neon` in another terminal. This creates the first account in `ADMIN_EMAILS` through the app, waits for its real email verification code, then checks sign-in, session restoration, authenticated data pages, and sign-out. Use it only for an administrator account you intend to create. It does not change an existing account's password or skip email verification.

The verifier stores its generated password in the Git-ignored `.neon-verification.local` file. When prompted, add the received code as an `otp` field in that file, preserving the other fields. After verification, use the app's password-reset flow to choose your own password and remove the local verification file when it is no longer needed. Never commit this file or share its password.

## Operations and recovery

Configure station name, pricing, phone, address, and timezone in Settings. Record real opening inventory through adjustments with a clear reason. Use supplier assignments and low-stock thresholds to prepare reorders; the app does not place external supplier orders or send messages automatically.

Monitor Vercel function errors and Neon connection/compute usage. API errors include an `X-Request-Id` header and a request ID in error JSON; logs contain the request ID and error code rather than customer details, SQL parameters, or tokens. JWT failures return 401, disallowed accounts return 403, and stock/state conflicts return 409. A failed data request displays an error with a retry action.

Before a production schema change, create a Neon child branch/backup and test the migration there. Review the project's retention window and maintain independent backups appropriate to the station's needs. Use Vercel's previous deployment for code rollback only when compatible with the current schema. Database recovery is a separate Neon restore workflow; do not drop tables or rerun edited initial migrations to recover an app release.

See [Project details](PROJECT.md#scope-and-operating-limits) for supported workflows and operating limits.

## Provider references

- [Vite and API functions on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel connection pooling](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon React Auth](https://neon.com/docs/auth/quick-start/react)
- [Neon JWT validation](https://neon.com/docs/auth/guides/plugins/jwt)
- [Neon Auth production checklist](https://neon.com/docs/auth/production-checklist)
