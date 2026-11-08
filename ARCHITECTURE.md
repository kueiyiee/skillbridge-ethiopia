# SKILLBRIDGE Architecture

## Runtime architecture

SKILLBRIDGE is a modular monolith: one Node.js/Express process hosts the REST API and serves the React single-page application. It is not currently a microservices deployment.

- **Frontend source:** root `src/` (React 19, Vite, TypeScript, Tailwind CSS).
- **Frontend entry files:** root `index.html`, `src/main.tsx`, and `vite.config.ts`.
- **Backend source:** `backend/src/` (Express, TypeScript, Zod).
- **Database:** MySQL through Drizzle ORM and mysql2.
- **Shared contracts:** `shared/types/`.
- **Operational integration tests:** `tests/integration/`.
- **Deployment:** `deployment/` and `docs/deployment-cpanel.md`.

The `frontend/` directory is a non-runtime architecture blueprint retained for planning. It is not a second frontend application, is excluded from the root TypeScript build, and must not be used as the active source of UI changes unless a deliberate migration is planned.

## Repository layout

```text
.
├── backend/
│   └── src/
│       ├── app.ts                 # Express middleware and route composition
│       ├── server.ts              # API process startup and environment checks
│       ├── config/                # CORS, security headers, runtime config
│       ├── middleware/            # Auth, request IDs, logging, rate limits, errors
│       ├── modules/               # Feature routers/controllers/services/repositories
│       ├── infrastructure/        # MySQL/Drizzle, migrations, admin provisioning
│       ├── services/              # Cross-feature backend services
│       └── validation/            # Shared backend validation
├── src/                           # Active React/Vite application
│   ├── app/                        # App shell, providers, route composition
│   ├── components/                 # Shared UI and layout components
│   ├── features/                   # Feature-owned pages and components
│   ├── pages/                      # Public/static pages
│   ├── services/                   # Browser API client
│   ├── styles/                     # Global styles and design tokens
│   └── types/                      # Frontend declarations
├── shared/types/                   # Runtime-independent contracts
├── tests/integration/              # Disposable-MySQL workflow tests
├── prisma/migrations/              # Checked-in SQL migration history/baseline
├── deployment/                     # cPanel/Passenger packaging
├── docs/                           # Architecture, API, setup, operations
├── frontend/                       # Planning blueprint only; not runtime source
├── server.ts                       # Root compatibility launcher
├── index.html                      # Vite entry document
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Request and dependency flow

```text
Browser
  └─ React feature/page
      └─ src/services API client
          └─ same-origin /api request
              └─ Express middleware
                  └─ feature router
                      └─ controller + Zod validation
                          └─ feature service/policy
                              └─ repository / Drizzle adapter
                                  └─ MySQL

Development:
root server.ts -> backend/src/server.ts -> Express + Vite middleware

Production:
Passenger deployment/app.js -> generated root server.js
  -> backend startup -> Express serves dist/ and /api
```

Keep feature-specific business logic inside its backend module. Controllers should handle HTTP parsing/status codes, services should enforce business rules, and repositories should own persistence queries. Cross-feature infrastructure belongs under `backend/src/infrastructure`; shared HTTP middleware belongs under `backend/src/middleware`. The frontend should call the API through the shared browser API client rather than reaching into backend code.

## Structural rules

1. Keep the active Vite app in root `src/` until the Vite root, TypeScript aliases, build scripts, tests, and Passenger package are migrated together.
2. Keep Express implementation under `backend/src/`; root `server.ts` is a compatibility entry point, not a second backend.
3. Keep `index.html`, `vite.config.ts`, root `package.json`, and generated `server.js` at the root because the current deployment/build pipeline expects them there.
4. Do not put server secrets in frontend files or `VITE_*` variables.
5. Do not import frontend modules from backend modules or backend runtime modules from the browser bundle. Share only environment-neutral types/schemas where appropriate.
6. Treat `frontend/` as documentation/blueprint only. Avoid copying runtime code into it.
7. Do not add a microservice or move database ownership without a separately reviewed deployment, observability, authentication, and data-consistency plan.

## Security and operations boundaries

- Express owns authentication, role/ownership checks, employer verification gates, validation, rate limiting, and response security headers.
- MySQL owns durable application state, audit history, session revocation, and shared rate-limit counters.
- Verification documents are stored outside the public static directory with restrictive filesystem permissions and are delivered only through authenticated admin routes. The application currently validates file signatures and size/type; it does **not** perform antivirus/malware scanning.
- Production startup checks connectivity; it does not migrate, seed, reset, or silently substitute mock data.
- The old PostgreSQL database has not been migrated. Keep it backed up and separate from the MySQL application target.

See [docs/architecture.md](docs/architecture.md) for detailed module responsibilities, [docs/API_INVENTORY.md](docs/API_INVENTORY.md) for route behavior, and [docs/production-readiness.md](docs/production-readiness.md) for remaining release gates.
