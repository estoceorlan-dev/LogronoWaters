# Logrono Waters

### AquaFlow · Water refilling station management

[![App checks](https://github.com/estoceorlan-dev/LogronoWaters/actions/workflows/ci.yml/badge.svg)](https://github.com/estoceorlan-dev/LogronoWaters/actions/workflows/ci.yml)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Node.js 22](https://img.shields.io/badge/Node.js-22-417E38?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)

A full-stack operations dashboard for a water refilling station, bringing customer records, pickup and delivery orders, container inventory, and daily sales into one workspace.

The project addresses a practical operational problem: keeping order fulfillment, available stock, and collected payments consistent as staff record deliveries, refill containers, and serve customers.

## What the app does

| Area               | Capabilities                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard          | Daily collected revenue, containers sold, open orders, outstanding balances, and sales and stock charts                                       |
| Orders             | Pickup and delivery, automatic pricing, stock reservations, fulfillment status, manual payment tracking, CSV exports, and printable summaries |
| Customers          | Contact details, delivery addresses, purchase history, and archived records                                                                   |
| Inventory          | Filled and empty containers, caps and seals, refill production, adjustments, and stock movement history                                       |
| Station operations | Low-stock alerts, preferred suppliers, equipment maintenance, pricing, and business settings                                                  |
| Staff access       | Verified email accounts, password recovery, administrator and staff permissions, and session restoration                                      |

The interface supports mobile navigation and persistent light and dark themes.

## Engineering highlights

- **Consistent stock operations.** Database transactions keep order reservations, cancellations, and refill production together. Request IDs prevent duplicate stock changes when a submission is retried.
- **Reliable historical records.** Orders retain their original customer name, address, and pricing even when current records change. Money is stored as integer centavos.
- **Server-enforced access.** The API validates Neon Auth JWTs and staff permissions before accessing business data. Database credentials remain on the server.
- **A defined deployment path.** Vercel hosts the frontend and API; Neon provides Postgres and managed authentication. Versioned migrations run separately from frontend builds.
- **Workflow verification.** Database/API tests cover business rules, authorization, and concurrency. Playwright exercises desktop and mobile workflows.

## Stack

| Layer            | Technology                                                      |
| ---------------- | --------------------------------------------------------------- |
| Frontend         | React 19, Vite, React Router, Tailwind CSS                      |
| Charts and icons | Recharts, Lucide React                                          |
| API              | Node.js 22, Vercel Functions, Zod                               |
| Database         | Neon Postgres, `pg`, versioned SQL migrations                   |
| Identity         | Managed Neon Auth, JWT verification with `jose`                 |
| Quality          | Node.js test runner, PGlite, Playwright, Oxlint, GitHub Actions |

## Run locally

Use Node.js 22 and a Neon development branch with managed Auth enabled.

```sh
git clone https://github.com/estoceorlan-dev/LogronoWaters.git
cd LogronoWaters
npm ci
```

Copy [.env.example](.env.example) to `.env.local` and configure the database, Auth URLs, and approved staff email addresses. Register the local frontend origin in Neon Auth's trusted domains.

```sh
npm run db:migrate
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. The development command starts both the frontend and API. Create an approved account, verify its email, then add customers and record the station's actual opening stock.

For production setup, see the [deployment guide](DEPLOYMENT.md).

## Quality checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

The checks run without production credentials. Database tests use disposable PGlite by default; a dedicated `TEST_DATABASE_URL` enables native Postgres testing. Browser tests use a local identity fixture, so production email delivery and Neon Auth configuration require separate deployment verification.

## Documentation

- [Architecture](ARCHITECTURE.md) — system boundaries, data model, authentication, and consistency guarantees.
- [Project details](PROJECT.md) — operational workflows, permissions, business rules, and scope.
- [Deployment](DEPLOYMENT.md) — Vercel and Neon setup, environment variables, migrations, and operations.

The repository contains the application and deployment configuration. A live production deployment is not documented yet. The app supports one station per deployment and records payments and refunds handled outside the system.
