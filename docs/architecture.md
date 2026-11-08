# SKILLBRIDGE: System Architecture Specification

## 1. Architecture decision

SKILLBRIDGE is currently a **modular monolith**. A single Node.js process runs the Express REST API and serves the React single-page application. The backend is organized by business feature; the application is not currently deployed as a set of microservices.

| Layer | Active location | Responsibility |
|---|---|---|
| Browser application | `src/` | React pages, feature UI, navigation, state, API client |
| HTTP/API composition | `backend/src/app.ts` | Express middleware, rate limits, route mounting, static SPA hosting |
| API feature modules | `backend/src/modules/` | Routers, controllers, validation, business services, repositories |
| Cross-cutting backend | `backend/src/middleware/`, `backend/src/services/` | Authentication, request IDs, logging, errors, reusable services |
| Infrastructure | `backend/src/infrastructure/` | MySQL connection, Drizzle adapter, migrations, provisioning |
| Shared contracts | `shared/types/` | Environment-neutral types shared across browser and server |
| Persistence | MySQL | Accounts, jobs, applications, verification, audit, AI conversations |
| Operations | `deployment/`, `docs/` | Passenger packaging, deployment and operational procedures |

## 2. Frontend responsibilities

The active frontend is the root `src/` directory. Its main boundaries are:

- `src/app/`: application shell, route composition, and global providers.
- `src/features/`: feature-owned UI and workflows (auth, candidates, employers, jobs, skills, administration, and AI Nexus).
- `src/components/`: reusable visual components and layouts.
- `src/pages/`: public informational pages.
- `src/services/`: same-origin HTTP API client.
- `src/styles/`: global styles and design tokens.

The root `index.html` and `vite.config.ts` are part of the active frontend build. The separate `frontend/` folder is only a future architecture blueprint; it is not built, served, or the place to implement current product changes. Its presence must not be interpreted as a second frontend.

## 3. Backend responsibilities

- `backend/src/server.ts` validates required runtime configuration, connects to MySQL, and starts the application.
- `backend/src/app.ts` configures Express, request/security middleware, rate limiting, feature route mounting, health endpoints, and production SPA hosting.
- `backend/src/modules/index.ts` is the central feature-router registry.
- Each feature under `backend/src/modules/` owns its routes and domain behavior.
- `backend/src/middleware/` contains shared request middleware such as authentication, verified-employer enforcement, request IDs, logging, error handling, and the MySQL-backed rate-limit store.
- `backend/src/infrastructure/database/` owns the Drizzle/mysql2 adapter, migration runner, and one-time administrator provisioning.

Keep HTTP concerns in controllers, business rules and orchestration in services, and SQL persistence in repositories or the database adapter. Do not move all features into a generic global services folder.

## 4. Request flow

```text
React feature -> src/services API client -> same-origin /api
  -> Express middleware -> feature router -> controller / schema
  -> feature service / policy -> repository -> Drizzle adapter -> MySQL
```

The browser never receives database credentials or AI provider keys. The backend derives user identity and role from the authenticated session; ownership checks must use that server-side identity rather than client-supplied user IDs.

## 5. Runtime and deployment

- Development: root `server.ts` imports `backend/src/server.ts`; Express mounts Vite middleware.
- Production build: Vite writes the browser assets to `dist/`; esbuild creates root `server.js` and the standalone migration/provisioning bundles.
- cPanel/Passenger: `deployment/app.js` loads generated root `server.js`.
- The current build/deployment pipeline intentionally expects root `index.html`, `src/`, `vite.config.ts`, `package.json`, and the compatibility launcher. Moving those paths without migrating the build, tests, and Passenger packaging together would break deployment.

## 6. Database and migration boundaries

MySQL is the active database, accessed through Drizzle ORM and mysql2. Schema changes are applied explicitly through the migration runner; application startup does not migrate, seed, or reset the database. Integration tests must use a disposable MySQL database whose name contains `test`.

The earlier PostgreSQL database is a separate source system and has not been migrated. Do not repoint the MySQL application at PostgreSQL or run MySQL migrations against it. A migration requires a separately backed-up export, transformation, import, reconciliation, and workflow verification.

## 7. AI and optional ML

OpenAI/Gemini provider calls are made server-side through the AI Nexus provider service, with bounded timeouts, output validation, and fallback behavior. Provider credentials must remain in protected server environment variables.

The optional Python `ml_service/` directory is an experimental/future extension. The current API's matching calculation is the deterministic TypeScript implementation; the Python service is not part of the current request path or standard deployment.

## 8. Document storage

Employer verification documents are written to a private directory outside the public `dist/` static tree. The backend validates base64 encoding, maximum size, file signature, and declared content type, stores random filenames with restrictive file permissions, and serves documents through authenticated admin endpoints with no-store and content-security headers.

This is not equivalent to malware scanning. No antivirus/Content Disarm and Reconstruction integration is currently configured. Before accepting production uploads at scale, add a managed malware-scanning/quarantine workflow and operational retention/backup controls.

## 9. Architecture rules

1. Keep the current runtime boundaries until a coordinated migration is ready.
2. Keep feature-specific code with its feature.
3. Keep shared contracts environment-neutral; never share server secrets or database code with the frontend.
4. Centralize API mounting in `backend/src/modules/index.ts`.
5. Validate external input at the HTTP boundary and enforce authorization/ownership again in business operations.
6. Add migrations and tests with every schema change.
7. Keep deployment and production database operations explicit, backed up, and separately reviewed.

For the actual routes and their access requirements, see [API inventory](API_INVENTORY.md). For release gates, see [production readiness](production-readiness.md).
