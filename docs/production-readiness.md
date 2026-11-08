# Production Readiness Checklist

This document separates code-level checks from operational checks that cannot be certified by repository CI alone.

## Implemented in the repository

- [x] React/Vite browser app and Express API are organized as one modular monolith.
- [x] MySQL access is centralized through the Drizzle/mysql2 adapter.
- [x] Startup checks required configuration and database connectivity; it does not run migrations or seed data.
- [x] Authentication, role checks, employer verification gates, request validation, and audit workflows are implemented in backend modules.
- [x] Security response headers are applied centrally; HSTS is emitted only for secure production requests.
- [x] Shared MySQL rate limiting covers login, password recovery, registration, AI requests, password changes, email verification, and employer verification document uploads.
- [x] Employer verification documents are size/type/signature checked, stored outside the public static directory, and served through authenticated admin routes.
- [x] CI runs dependency audit, unit tests, TypeScript validation, frontend/server builds, and isolated MySQL integration tests.

## Remaining engineering work

- [ ] Replace the placeholder files in `frontend/e2e/` with real browser tests using a maintained browser automation framework, and run them against an isolated test environment.
- [ ] Add malware scanning/quarantine for uploaded business documents before admin access; file signature checks do not detect malware.
- [ ] Inventory inline scripts, fonts, image/API origins, and provider endpoints; add CSP in report-only mode, resolve violations, then enforce a nonce/hash-based policy.
- [ ] Review remaining in-memory feature rate limits and decide which need shared MySQL storage based on deployment topology and abuse impact.
- [ ] Add upload retention, storage-capacity monitoring, backup, restore, and orphan-file reconciliation procedures.
- [ ] Add route-level pagination/filtering where API inventory documents current unbounded collections.
- [ ] Add production-grade observability: error aggregation, uptime/latency alerts, database connection/pool metrics, and AI provider failure metrics.
- [ ] Add a documented disaster-recovery exercise and verify that backups can be restored.

## Hosting and release gates (must be completed on the actual host)

- [ ] Confirm the hosting provider's Node.js version, Passenger startup path, assigned port, process model, and reverse-proxy topology.
- [ ] Confirm `trust proxy` matches the actual trusted proxy chain; do not widen it blindly. Verify client IP handling for rate limiting from the deployed network.
- [ ] Confirm TLS is enforced before enabling HSTS, and verify secure cookies and same-origin frontend/API behavior.
- [ ] Configure protected production secrets and rotate any credentials that may have been exposed. Never put secrets in frontend variables or deployment archives.
- [ ] Provision a dedicated MySQL database/user with least privilege and provider-required TLS. Do not point the MySQL app at the legacy PostgreSQL database.
- [ ] Take a verified database backup before any schema change; apply migrations explicitly during a controlled maintenance window.
- [ ] Configure the private verification-document directory outside the public web root with restricted ownership and permissions.
- [ ] Run health/readiness checks and authenticated smoke tests after deployment.
- [ ] Verify registration, OTP, login, password recovery, role isolation, employer verification, document access, job posting, applications, messaging, AI fallback, and admin audit workflows using non-production test accounts.
- [ ] Confirm monitoring, alert routing, backup retention, restore procedure, and rollback plan.

## Important status

A green GitHub Actions run proves only the workflows executed by CI. It does not prove production deployment, production database compatibility, malware scanning, CSP enforcement, backup recoverability, or security certification. Do not label the system production-ready until the applicable engineering and hosting gates above have been completed and evidenced.
