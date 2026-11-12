# Vercel + Render + cPanel deployment

This repository supports two deployment modes:

- **Vercel:** serves the root Vite/React application from the generated `dist/` directory.
- **Render:** runs the existing Express API as a long-lived Node.js web service.
- **cPanel:** remains the MySQL database host. The Render API connects to it using the private server-side `DATABASE_URL`.

The optional `ml_service/` directory is experimental and is not part of this production deployment.

## Service routing

The browser continues to call same-origin `/api/*` endpoints. The root `vercel.json` proxies those paths to `https://skillbridge-api.onrender.com/api/*`, while all other paths resolve to the Vite SPA entry point.

This proxy is intentional: authentication uses HTTP-only cookies. Keeping API calls on the Vercel origin avoids cross-site cookie restrictions between the default `vercel.app` and `onrender.com` domains. Do not change the frontend to call the Render hostname directly unless you also redesign and test the authentication cookie strategy.

The Render service is named `skillbridge-api` in `render.yaml`, which gives it the expected default hostname `skillbridge-api.onrender.com`. If Render assigns a different hostname because that name is unavailable, update the API rewrite destination in `vercel.json` to the actual Render public URL and redeploy Vercel.

## Deploy the backend to Render

1. In Render, choose **New → Blueprint** and connect this repository, or create a Web Service manually using the settings below.
2. Select branch `main`.
3. Use the configuration in `render.yaml`:
   - Region: Frankfurt
   - Build command: `npm ci && npm run build:server`
   - Start command: `npm start`
   - Health check: `/api/health/ready`
4. Add the required environment variables in Render's protected Environment page:
   - `DATABASE_URL`: MySQL connection URL for the cPanel database, URL-encode reserved characters in the password.
   - `JWT_SECRET`: unique random secret, at least 32 characters.
   - `EMAIL_OTP_SECRET`: a different unique random secret, at least 32 characters.
   - `OPENAI_API_KEY` and/or `GEMINI_API_KEY`: server-side AI provider keys. The AI feature can be unconfigured, but it will not generate responses without a provider key.
   - `MFA_ENCRYPTION_KEY`: separate high-entropy server secret (at least 32 characters) used to encrypt TOTP seeds. Generate independently from `JWT_SECRET`; never expose it to the frontend.
   - `APP_URL` must be the valid public application origin (HTTPS in production). Employer and Admin A4 PDF reports use it to generate direct QR verification links.
   - Run `npm run db:migrate` after deploying the release that introduces the issued-report registry and authenticator MFA tables. The migration is additive and creates the report verification registry table.
   - `RESEND_API_KEY`, `OTP_FROM_EMAIL`, `APP_URL`, and `EMAIL_VERIFICATION_URL`: configure these for production email verification and password recovery. Set the two URL values to the public Vercel application origin and its `/verify-email` route respectively.
   - Any other integration variables required by your selected features (for example `SUPPORT_EMAIL`, `AI_PRIMARY_PROVIDER`, and `AI_FALLBACK_PROVIDER`).
5. Confirm Render's generated public URL is `https://skillbridge-api.onrender.com`. If it differs, update the Vercel rewrite as described above.
6. Wait for `/api/health/ready` to report ready. The health check depends on a successful database connection.

Render sets `PORT` automatically. The server binds to `0.0.0.0`. `SERVE_FRONTEND=false` prevents Render from trying to serve a Vite `dist/` folder; the same code still serves the SPA by default for the existing cPanel deployment.

## Configure cPanel MySQL access

1. In cPanel, confirm the target database is **MySQL**, not the former PostgreSQL database.
2. Create or select a dedicated database user with only the privileges required by SKILLBRIDGE.
3. Enable Remote MySQL access for the Render API's outbound IP address(es). Prefer Render's dedicated static outbound IP feature if available; otherwise use the outbound IP ranges shown for the Render service's region and restrict access as tightly as the cPanel host allows. Do not leave MySQL open to the entire internet unless the hosting provider gives you no narrower option.
4. Build the `DATABASE_URL` using the cPanel MySQL hostname, port, database name, username, and password. Never put it in a `VITE_*` variable or commit it.
5. Back up the database before applying migrations. Once connectivity is confirmed, run `npm run db:migrate` from a trusted local/admin environment using the same production `DATABASE_URL`, or use the protected Render Shell if your plan supports it. Do not run seed commands against a live database unless you explicitly intend to seed it.

The cPanel provider must permit remote MySQL connections from Render. A successful Render deployment alone does not prove database connectivity or migration completion.

## Deploy the frontend to Vercel

1. Import `kueiyiee/skillbridge-ethiopia` into Vercel and select branch `main`.
2. Set the project root to `./`.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. Install command: `npm ci`.
4. No public API key or database variable is required in Vercel. The API routing is handled by `vercel.json`.
5. Deploy after the Render API has a stable public URL and its rewrite destination has been confirmed.

Vercel's SPA rewrite keeps direct navigation and refreshes on client-side routes working, while the earlier `/api/*` rewrite sends API traffic to Render.

## File uploads and persistent storage

Both profile images and employer verification documents are written to the API server's local filesystem. Render's default filesystem is ephemeral, so either kind of upload can disappear after a restart or redeploy. Before enabling these uploads in production, attach a persistent disk to the Render service and set `PROFILE_MEDIA_DIRECTORY` and `EMPLOYER_VERIFICATION_DOCUMENT_DIRECTORY` to directories on that disk, or migrate both features to durable object storage. Do not assume the Render container filesystem is permanent. A persistent disk is a paid-plan consideration; if you remain on the free instance, treat file uploads as non-durable and do not use it for real employer verification evidence.

## Local development and cPanel compatibility

Local development remains unchanged: `npm run dev` starts Express and Vite together, and Vite proxies `/api` to `http://127.0.0.1:3000`. The cPanel packaging workflow remains compatible because `SERVE_FRONTEND` defaults to serving the production SPA unless explicitly set to `false`.

## Production verification checklist

- [ ] Render build succeeds and the service binds to Render's injected `PORT`.
- [ ] `/api/health` returns the API health response.
- [ ] `/api/health/ready` confirms MySQL readiness.
- [ ] Vercel serves the home page and direct client-side routes after refresh.
- [ ] Vercel `/api/health` reaches the Render API through the rewrite.
- [ ] Register, email OTP verification, login, refresh/session check, and logout work through the Vercel domain.
- [ ] Job seeker, employer, and admin workflows can read and write their authorized API data.
- [ ] AI Nexus streaming works through the Vercel API proxy.
- [ ] Profile image and employer document uploads persist across a Render restart/redeploy.
- [ ] Database backups, migrations, rate limits, and production secrets are verified.

A green deployment is not equivalent to a production sign-off. In particular, this repository change cannot create your Render/Vercel projects, configure cPanel remote access, supply private credentials, run production migrations, or verify your live domain.
