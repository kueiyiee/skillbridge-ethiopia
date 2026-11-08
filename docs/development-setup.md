# Development Setup

## Requirements

- Node.js 22.x, or 20.19+
- npm
- MySQL 8.0.16+ configured in `DATABASE_URL` (MySQL 8.4 LTS recommended)
- A unique `JWT_SECRET`; at least 32 characters is required in production

Use an isolated local database. Do not point local development at production. The app requires a MySQL-compatible server and has no mock or embedded database fallback. XAMPP currently bundles MariaDB 10.4.32 in this environment; it can be used for local smoke tests, but it is older than the supported MySQL 8.0.16+ target. CI runs the migration suite against MySQL 8.4.

## Install and Configure

```bash
npm install
```

Start **MySQL** in the XAMPP Control Panel. Copy `.env.example` to `.env` and configure `DATABASE_URL` for the local `skillbridge_db` database. The app database is created with `npm run db:create`; that command only creates it if absent. Create a separate `skillbridge_test` database for integration tests and give it a dedicated local user with privileges only on that database.

Uncomment/configure `TEST_DATABASE_URL` for `skillbridge_test`. The examples use placeholders; do not commit `.env`. For AI features, create keys from [OpenAI API keys](https://platform.openai.com/api-keys) and [Google AI Studio](https://aistudio.google.com/app/apikey), then set `OPENAI_API_KEY` and `GEMINI_API_KEY` only in the server `.env`. Do not copy keys into chat, source, Vite variables, logs, or documentation; revoke and replace any key previously exposed. Configure `AI_PRIMARY_PROVIDER` and `AI_FALLBACK_PROVIDER` as distinct `openai` or `gemini` values; defaults are OpenAI primary and Gemini fallback. Either provider may be primary, a single configured provider works by itself, and example placeholder values are treated as unconfigured. `OPENAI_MODEL` and `GEMINI_MODEL` optionally override `gpt-4.1-nano` and `gemini-3.8-flash`; confirm model access in the provider account. The default OpenAI model is the lower-latency nano variant for short assistant responses. Gemini structured generation uses the Google GenAI SDK Interactions API. `AI_REQUEST_TIMEOUT_MS` bounds each provider attempt to 1-25 seconds (12 seconds by default); at most one configured fallback attempt follows a temporary failure, so total provider wait is bounded to two attempt windows. Nexus streams validated-schema content through `/api/ai/nexus/query/stream`; conversations remain private and are never shared through a response cache. Startup validates provider names and checks configured account/model access without printing credentials. Never use a `VITE_` prefix or put keys in frontend configuration. With no keys, deterministic guidance is labeled as such. Fallback occurs only for timeouts, network errors, rate limits, and provider 5xx errors, not validation errors or content refusals. Provider latency logs contain provider, duration, first-token time, and validation status only; in-memory counters reset on restart and no prompt text is recorded. Optional `ML_SERVICE_URL` is not currently called by the application.

For a newly created, empty local development database, apply the checked-in baseline, then start the combined Express/Vite server:

```bash
npm run db:create
npm run db:migrate
npm run db:inspect
npm run dev
```

For separate terminals, start `npm run dev:backend` first, then `npm run dev:frontend`. Vite serves the UI on port 5173 and proxies `/api` requests to `http://127.0.0.1:3000`; set `API_PROXY_TARGET` in the shell if the backend uses a different URL. The integrated `npm run dev` remains the default single-process option.

To provision the administrator once, enter its password at a hidden PowerShell prompt and keep it only in the temporary shell environment:

```powershell
$env:ADMIN_USERNAME = "admin@skillbridge.ss"
$securePassword = Read-Host "Administrator password" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run admin:provision
Remove-Item Env:ADMIN_PASSWORD
```

The provisioner creates an active `ADMIN` account only when no administrator or conflicting account exists. It stores a bcrypt hash with work factor 12 and never prints the password or hash. The password is not available to this session, so run this command in the shell after entering the separately supplied secret.

## Checks

```bash
npm run lint
npm test
npm run build
npm run build:server
```

`npm run db:inspect` is read-only and prints table counts. Confirm application tables are empty before adding real records or preparing an export. `npm test` runs database-independent unit tests. For integration tests, start XAMPP's MySQL service and provide the local test URL in `.env`:

```powershell
npm run test:integration
```

The integration command only accepts local MySQL-compatible servers and database names containing `test`; it applies migrations to that test database. Never use a production URL. `npm run build:server` creates the Passenger-compatible root `server.js`, `migrate.js`, and `admin-provision.js`.

## Startup and Troubleshooting

- Missing `DATABASE_URL`/`JWT_SECRET` stops startup with variable names only.
- A MySQL connection failure stops startup before opening the listener; check the host, port, URL-encoded password, database grants, TLS requirements, and host network access.
- `/api/health` checks API liveness; `/api/health/ready` checks MySQL with `SELECT 1`.
- No command in the normal development/start flow applies migrations or seed data. Apply migrations explicitly to a verified fresh MySQL database only.
