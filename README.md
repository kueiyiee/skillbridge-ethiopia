# SKILLBRIDGE Ethiopia

> Bridging Talent to Opportunity Through Verified Skills.

SKILLBRIDGE Ethiopia is a skills-first employment platform connecting Ethiopian talent with verified employers through intelligent job matching, skill assessments, AI-powered career guidance, and transparent recruitment.

## Objectives and Features

- Help job seekers demonstrate verified skills and find relevant employment.
- Help employers discover talent and manage transparent recruitment workflows.
- Support employer verification, skill assessments, explainable job matching, and career guidance.
- Provide role-based experiences for Job Seekers, Employers, and Administrators, including applications, messaging, and platform management.

The public website is [www.kueiyiee.tech](https://www.kueiyiee.tech).

## Stack

- React 19, Vite, TypeScript, Tailwind CSS, Lucide
- Node.js, Express, TypeScript, Zod
- Drizzle ORM with mysql2 and MySQL 8.0.16+ (MySQL 8.4 LTS recommended)
- Optional server-side OpenAI and Gemini integration with bounded fallback
- MySQL integration tests; PGlite has been removed

## Quick Start

Requires Node.js 22.x or Node.js 20.19+, plus MySQL 8.0.16+ (MySQL 8.4 LTS recommended).

```bash
npm ci
```

Copy `.env.example` to `.env` and configure an isolated development MySQL database, `JWT_SECRET`, and optional integration settings. Use `Copy-Item .env.example .env` in PowerShell or `cp .env.example .env` in a POSIX-compatible shell. Do not point local development at production databases. `.env` is ignored by Git; keep server-side keys and credentials out of `VITE_` variables, source files, commits, and client bundles.

Email registration verification is enabled for Job Seeker and Employer accounts. Configure `RESEND_API_KEY`, `OTP_FROM_EMAIL`, `EMAIL_OTP_SECRET`, `EMAIL_OTP_TTL_MINUTES`, `EMAIL_VERIFICATION_URL`, `APP_NAME`, and `SUPPORT_EMAIL` in the server environment; never use `VITE_` prefixes for these values. `EMAIL_OTP_SECRET` must be a unique random secret of at least 32 characters. Without Resend configuration, registration remains pending and development returns an explicit setup error rather than pretending to send a message.

Password recovery uses separate hashed OTP challenges and the same backend-only Resend configuration. The public endpoints are `POST /api/auth/forgot-password`, `POST /api/auth/resend-reset-otp`, and `POST /api/auth/reset-password`. Reset requests use a generic response for unknown, ineligible, and eligible accounts; the reset token is held in an HTTP-only, same-site cookie and is never put in a URL or browser storage. Codes expire according to `EMAIL_OTP_TTL_MINUTES`, allow at most five guesses per challenge, and are account- and IP-rate-limited. A successful reset changes the password hash and increments the account auth version, invalidating existing sessions, then attempts to send a password-change notice.

For local development, Vite serves the verification page at `http://127.0.0.1:5173/verify-email`; configure `EMAIL_VERIFICATION_URL` to that frontend URL. Browser API requests use same-origin `/api` paths, which Vite proxies to the backend on port `3000` by default (`API_PROXY_TARGET` can override the proxy target). In production, set `EMAIL_VERIFICATION_URL` to the public frontend `/verify-email` URL and `APP_URL` to the public application origin.

Before starting the application, apply database migrations with `npm run db:migrate`. This includes the shared production rate-limit table, email verification fields, and the password-reset challenge table plus session auth-version field. For Resend production delivery, verify your sending domain in the Resend dashboard, publish its requested DNS records, and set `OTP_FROM_EMAIL` to an address at that domain. Set `EMAIL_VERIFICATION_URL` to the public `/verify-email` route and `APP_URL` to the public application origin. Add these values to the protected server environment, not the frontend build.

Candidate skill assessment support uses the existing `skill_assessments` records plus persistent question and response tables. Apply migrations before running `npm run db:seed`; the seed installs the platform-authored five-question assessments for the seven skills in the initial catalog. Other skills remain manageable and searchable, but are explicitly unavailable for assessment until a question set is curated. Each attempt is stored in history. A score of at least 80% marks the candidate's skill as platform verified; scores map to Beginner (<50%), Intermediate (50–69%), Advanced (70–84%), and Expert (85%+). Self-reported proficiency alone never sets verification.

```bash
npm run dev
```

The application exits before listening if `DATABASE_URL` or `JWT_SECRET` is missing or MySQL is unavailable. Startup never migrates, resets, or seeds the configured database.

The email-verification evidence migration adds a nullable verification timestamp and changes only the default for future `emailVerified` values to false; it does not rewrite existing account flags. The admin directory marks legacy true flags without a recognized method or verification timestamp as **Action required** instead of claiming mailbox verification. Review those accounts and their available challenge/audit history individually; do not bulk-mark them verified. Newly provisioned administrators start inactive and must complete the existing OTP workflow before they can sign in. If rolling back, first back up the database and reconcile pending registrations; the project migration runner does not automatically roll back applied migrations.

## System Architecture

The React/Vite single-page application is served separately by Vercel, with `/api/*` requests reverse-proxied to the Express API on Render. The API uses Drizzle ORM and the cPanel-hosted MySQL database. Browser requests remain same-origin so the existing HTTP-only session cookies continue to work. AI provider credentials and integrations are server-side only. The optional `ml_service/` Python code is separate from the main Node.js build and is not part of this production deployment.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the component layout and [docs/API_INVENTORY.md](docs/API_INVENTORY.md) for the API surface.

## Common Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Express + Vite development server |
| `npm run dev:backend` | Standalone Express API on port 3000 |
| `npm run dev:frontend` | Standalone Vite UI on port 5173; proxies `/api` to port 3000 |
| `npm run lint` | TypeScript validation (`tsc --noEmit`) |
| `npm test` | Database-independent unit tests |
| `npm run test:integration` | MySQL migration and workflow tests using `TEST_DATABASE_URL` |
| `npm run db:migrate` | Apply the baseline to a fresh MySQL database |
| `npm run db:seed` | Seed the skill catalog and curated assessments |
| `npm run build` | Vite production frontend build |
| `npm run build:server` | Build Passenger `server.js` and the migration runner |
| `bash deployment/build-cpanel-package.sh` | Build the cPanel deployment archive (WSL/Git Bash) |
| `npm run start` | Start compiled production `server.js` |

`npm run lint` runs the configured TypeScript compiler check; this project does not currently define an ESLint script. Unit tests do not require a database. Integration tests require a disposable local MySQL database whose name contains `test`; never point `TEST_DATABASE_URL` at production or another shared database.

## GitHub CI and Deployment

GitHub Actions runs on pushes to `main` and pull requests targeting `main`. It installs from the lockfile, audits production dependencies, runs unit tests and TypeScript validation, builds the frontend and server bundles, and runs MySQL integration tests against an isolated MySQL 8.4 service. CI does not deploy to production.

The repository includes a cPanel Node.js/CloudLinux Passenger packaging path (`deployment/` and [docs/deployment-cpanel.md](docs/deployment-cpanel.md)). Production deployment remains a reviewed, manual operation until the hosting target, protected environment variables, and database readiness are confirmed.

## Architecture

- [Architecture overview](ARCHITECTURE.md)
- [Frontend/backend architecture details](docs/architecture.md)
- [API endpoint inventory](docs/API_INVENTORY.md)
- [API reference](docs/api-reference.md)
- [Database safety and setup](docs/database.md)
- [Local development setup](docs/development-setup.md)
- [cPanel deployment](docs/deployment-cpanel.md)
- [Vercel + Render + cPanel deployment](docs/deployment-vercel-render-cpanel.md)
- [Contribution guide](CONTRIBUTING.md)

## Production Database Safety

The former cPanel PostgreSQL database has not been migrated to MySQL. Obtain a new MySQL endpoint and least-privilege user from the hosting provider. Preserve and back up the PostgreSQL database until a separate export, transformation, import, and verification has been completed. Never point MySQL migrations at the PostgreSQL database or run destructive commands against production.

Live MySQL connectivity, migration execution, and data migration are not verified until a MySQL target is configured and tested.