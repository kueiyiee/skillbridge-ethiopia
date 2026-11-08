# cPanel Deployment

## Hosting Requirements

- cPanel Node.js App / CloudLinux Passenger support must be enabled by the provider.
- Node.js 22.x or Node.js 20.19+ is required by the current build stack.
- Create a MySQL 8.0.16+ database in cPanel (MySQL 8.4 LTS recommended) and assign a least-privilege application user.
- Obtain the exact MySQL host, port, database name, username, password, and TLS requirements from the provider. Do not assume the host is `localhost`.
- The previous PostgreSQL database is a separate source database and has not been migrated. Do not use its host or port for MySQL.
- If connecting remotely, use cPanel's MySQL remote-access allowlist for the application server's public outbound IP. Do not use `%`.

## Build

From WSL or Git Bash in the project root:

```bash
npm install
bash deployment/build-cpanel-package.sh
```

The script builds Vite assets and bundles the Express backend, migration runner, and one-time administrator provisioner. It does not connect to or modify either database.

## cPanel Configuration

Create/configure the Node.js application with startup file `app.js`. Configure environment variables in cPanel's protected environment settings (or a protected `.env` file):

```env
NODE_ENV=production
PORT=<PORT_ASSIGNED_BY_CPANEL>
DATABASE_URL=mysql://USER:<URL_ENCODED_PASSWORD>@HOST:3306/DATABASE_NAME?connection_limit=5
JWT_SECRET=<UNIQUE_RANDOM_SECRET_AT_LEAST_32_CHARACTERS>
APP_URL=https://<YOUR_APP_DOMAIN>
OPENAI_API_KEY=<OPTIONAL_SERVER_SIDE_OPENAI_KEY>
GEMINI_API_KEY=<OPTIONAL_SERVER_SIDE_GOOGLE_AI_STUDIO_KEY>
AI_PRIMARY_PROVIDER=openai
AI_FALLBACK_PROVIDER=gemini
OPENAI_MODEL=gpt-4.1-nano
GEMINI_MODEL=gemini-3.8-flash
ML_SERVICE_URL=<OPTIONAL_AND_CURRENTLY_UNUSED>
```

Install production dependencies:

```bash
npm install --omit=dev
```

Create keys at [OpenAI API keys](https://platform.openai.com/api-keys) and [Google AI Studio](https://aistudio.google.com/app/apikey). Set each key and provider order in cPanel's protected Node.js environment settings, not in a Vite environment, client bundle, source file, or deployment archive. Choose distinct `AI_PRIMARY_PROVIDER` and `AI_FALLBACK_PROVIDER` values (`openai` or `gemini`) to select provider order; a configured single provider can operate alone. Confirm that the configured account can access its selected model. Replace any previously exposed credentials. The startup log reports only whether providers are configured and their selected order; it never logs key values.

For provider troubleshooting, check that the hosting environment variable names are exact, the account key is active and authorized for the configured model, the account has billing/quota available, and outbound HTTPS access to the provider is permitted. Rate limits, timeouts, network errors, and provider outages can trigger one fallback attempt. Authentication/configuration errors and safety refusals do not trigger fallback. If both configured providers are unavailable, AI endpoints return deterministic guidance where available, clearly labeled as non-AI output.

Passenger loads `app.js`, which imports the generated `server.js`. For direct process management, use `npm run start`. Startup requires database access, the assigned port, and the JWT secret. It performs a connectivity query only; it does not migrate, reset, or seed a database.

For a newly created, empty MySQL database only, back it up if applicable and apply the MySQL baseline explicitly with `node migrate.js`. Never apply the MySQL baseline to the PostgreSQL source database. Existing production data needs a separately reviewed export, transformation, import, and reconciliation before switching `DATABASE_URL`; no data-transfer script has been run.

To provision the administrator, set `ADMIN_USERNAME=admin@skillbridge.ss` and a strong `ADMIN_PASSWORD` in the protected host environment temporarily, then run `node admin-provision.js` once and remove `ADMIN_PASSWORD`. Do not save the password to a deployment file, source control, frontend environment variable, or log.

## Verify and Diagnose

- `GET /api/health`: API liveness.
- `GET /api/health/ready`: MySQL readiness (`SELECT 1`).
- `GET /api/system/status`: runtime MySQL state and table counts.
- Review cPanel Node.js/Passenger logs for sanitized startup errors. Never copy database connection strings into logs or public tickets.

Before deployment, verify the MySQL endpoint and grants with the provider. Keep the PostgreSQL source database and a recoverable backup until record counts, relationships, timestamps, and critical workflows are verified on MySQL. Database backups should be stored separately from the application source.
