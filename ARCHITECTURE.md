# Architecture

SKILLBRIDGE is a same-origin single-page React application served by an Express process. Development mode mounts Vite middleware; production serves the built `dist/` folder. The cPanel Passenger entry remains `deployment/app.js`, which loads the generated root `server.js` bundle.

## Directory Tree

```text
.
├── backend/src/
│   ├── app.ts              # Express app composition and middleware
│   ├── config/             # CORS and security settings
│   ├── infrastructure/     # Drizzle-backed MySQL adapter
│   ├── middleware/         # Authentication, errors, request IDs, logging
│   ├── modules/            # Feature API routers and mount registry
│   ├── services/           # Reusable backend business logic
│   └── validation/         # Zod request schemas
├── src/
│   ├── app/                 # React app shell and global providers
│   ├── components/
│   │   ├── ai/              # AI Nexus assistant UI
│   │   ├── feedback/        # Global system/database status UI
│   │   ├── navigation/      # Header, mobile navigation, theme switcher
│   │   └── shared/          # Shared logo, footer, dashboard layout
│   ├── features/            # Feature-owned pages
│   │   ├── admin/
│   │   ├── ai-nexus/
│   │   ├── auth/
│   │   ├── candidates/
│   │   ├── employers/
│   │   ├── jobs/
│   │   └── skills/
│   ├── pages/               # Public informational pages
│   ├── services/            # Frontend HTTP API client
│   ├── styles/              # Global CSS/design tokens
│   └── types/               # Third-party ambient declarations
├── shared/types/            # Environment-independent frontend/backend contracts
├── prisma/                  # Retained MySQL baseline SQL and legacy schema reference
├── tests/integration/       # Isolated MySQL workflow tests
├── database/                # SQL reference exports; not production deployment steps
├── deployment/              # Passenger/cPanel packaging and operations
├── docs/                    # Architecture, API, database, setup, deployment
├── server.ts                # Root compatibility launcher used by hosting/scripts
├── index.html               # Vite entry document (kept at root)
└── package.json
```

## Dependency Flow

```text
React app shell -> feature pages -> shared UI/hooks -> frontend api-client -> /api
Root server.ts -> backend/src/server.ts -> Drizzle connect -> backend/src/app.ts
HTTP request -> feature route + middleware -> controller -> service -> repository -> shared Drizzle adapter -> MySQL
Frontend and backend -> shared/types
```

Repositories use the shared parameterized SQL adapter backed by Drizzle ORM and mysql2. The job-matching calculation is a backend service backed by its own repository. Multi-row account, job, application, verification, and evaluation writes use database transactions.

## Safe Structural Decisions

- Vite's root `index.html`, `src/main.tsx`, the retained SQL baseline, root `server.ts` compatibility launcher, and Passenger-generated root `server.js` remain where current build/deploy tooling expects them. Backend implementation lives in `backend/src/`.
- Production database startup performs a connectivity query only. It does not migrate, seed, reset, or fall back to mock state.
- The checked-in MySQL baseline is applied by the Drizzle migration runner. The old Prisma schema is retained as a reference only; PostgreSQL SQL archives are excluded from the application source.
- Application messaging uses the `application_messages` table and checked-in Drizzle migrations. Threads are anchored to job applications; server routes enforce candidate ownership, employer job ownership, and employer verification. Bulk sends create a separate private message per eligible application and use request-ID idempotency. Employer status changes follow the server-side forward-only hiring policy and persist the application update, candidate notification, and audit event together.
- The existing PostgreSQL database has not been migrated; keep it backed up and untouched until a verified data-transfer plan is completed.

See [docs/architecture.md](docs/architecture.md) for frontend/backend responsibilities and [docs/API_INVENTORY.md](docs/API_INVENTORY.md) for current routes and limitations.
