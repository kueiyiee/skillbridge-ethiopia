# Backend

This is the active Express API implementation. It is a feature-oriented modular monolith backed by MySQL through Drizzle ORM and mysql2.

Request flow: HTTP request → route and middleware → controller → service → repository → shared Drizzle adapter → MySQL. Feature routes/controllers/services do not import the database adapter; repositories own persistence.

```text
backend/src/
├── app.ts
├── server.ts
├── index.ts
├── config/                 # CORS and security policy
├── infrastructure/
│   └── database/           # Shared Drizzle connection and SQL/transaction adapter
├── middleware/             # Authentication, errors, request IDs, request logs
├── modules/                # Auth, jobs, candidates, employers, AI, admin, etc.
├── services/               # Shared domain operations
└── validation/             # Zod request schemas
```

The root `server.ts` is a small compatibility launcher because the existing Vite, cPanel, and Passenger scripts expect a root entrypoint. The MySQL baseline SQL, package manifest, and deployment build remain at the root to avoid duplicate configuration. PostgreSQL migration history is archived and must not be deployed to MySQL.

The jobs feature demonstrates the full module boundary:

```text
modules/jobs/
├── jobs.routes.ts
├── jobs.controller.ts
├── jobs.service.ts
├── jobs.repository.ts
├── jobs.schemas.ts
├── jobs.policy.ts
├── jobs.types.ts
├── jobs.mapper.ts
├── jobs.errors.ts
└── jobs.test.ts
```

Use the root scripts: `npm run dev`, `npm run lint`, `npm run build`, and `npm run build:server`. Production startup validates required environment variables, connects to MySQL before listening, and closes the pool during graceful shutdown. It never migrates or seeds the production database automatically.
