# Admin Portal Validation

**Date:** 2026-10-21  
**Decision:** NOT READY for production release  
**Scope:** Existing SKILLBRIDGE ET administration portal only. No separate dashboard was created.

## Baseline and Environment

- Frontend: React 19, React Router 7, Vite 8, TypeScript, Tailwind CSS.
- Backend: Express 4 with TypeScript.
- Active data layer: Drizzle ORM backed by `mysql2`; the Prisma schema and SQL baseline remain references/migrations.
- Read-only database inventory: local MariaDB 10.4.32, 19 tables, four migration-ledger entries, 20 application rows. No rows or schema were changed during validation.
- `TEST_DATABASE_URL` is not configured. The integration suite stopped at its safety guard before opening a database connection.
- The workspace directory has no Git metadata, so `git status` and a baseline diff are unavailable.

## Changes Made

- Fixed admin header/mobile shortcuts to route with the existing `section` query contract and highlight the correct destination.
- Added paginated, searchable admin job moderation within the existing Jobs & Moderation section. It displays employer approval, applicants, summary, and derived expiry; status changes require a reason, are rate-limited, row-locked, and audited.
- Prevented expired jobs from appearing as public active listings, public details, application targets, or public employer active-job counts. Expired jobs cannot be reactivated without updating their deadline; no job-edit/deadline API currently exists.
- Required a bounded moderation reason on the server, prevented duplicate pending employer verification submissions, and changed all affected generated record/audit IDs to UUIDs.
- Included verification review notes in the audit event and replaced review text that implied documents had been inspected when the portal cannot access them.
- Overall system health now reports degraded status for unavailable required tables, incomplete/unknown migrations, or an unavailable configured AI provider. The UI distinguishes degraded, unavailable, and unknown.
- Updated `docs/API_INVENTORY.md` and added regression tests for moderation reasons, duplicate verification policy, health status, and supported job moderation inputs.

### Files Changed

- `package.json`
- `backend/src/modules/admin/admin.controller.ts`
- `backend/src/modules/admin/admin.repository.ts`
- `backend/src/modules/admin/admin.routes.ts`
- `backend/src/modules/admin/admin.schemas.ts`
- `backend/src/modules/admin/admin.service.ts`
- `backend/src/modules/admin/admin.test.ts`
- `backend/src/modules/admin/admin.types.ts`
- `backend/src/modules/ai-nexus/ai-nexus.service.ts`
- `backend/src/modules/auth/auth.repository.ts`
- `backend/src/modules/candidates/candidates.repository.ts`
- `backend/src/modules/employers/employers.errors.ts`
- `backend/src/modules/employers/employers.policy.ts`
- `backend/src/modules/employers/employers.repository.ts`
- `backend/src/modules/employers/employers.service.ts`
- `backend/src/modules/employers/employers.test.ts`
- `backend/src/modules/evaluations/evaluations.repository.ts`
- `backend/src/modules/evaluations/evaluations.service.ts`
- `backend/src/modules/jobs/jobs.repository.ts`
- `backend/src/modules/jobs/jobs.service.ts`
- `backend/src/modules/system/system.service.ts`
- `backend/src/modules/system/system.test.ts`
- `src/app/router.tsx`
- `src/components/navigation/Header.tsx`
- `src/components/navigation/MobileNavigationDrawer.tsx`
- `src/features/admin/pages/AdminDashboard.tsx`
- `src/services/api-client.ts`
- `docs/API_INVENTORY.md`
- `docs/admin-portal-validation.md`

## Validation Evidence

- `npm run lint`: passed.
- `npm test`: 47 passed, 0 failed.
- `npm run build`: passed. Existing warning remains: the main JavaScript chunk is approximately 912 kB minified, above Vite's 500 kB advisory threshold.
- `npm run db:inspect`: passed read-only; reported MariaDB 10.4.32 and existing application data.
- `npm run test:integration`: not executed against a database; exited with the explicit guard requiring a disposable local MySQL database named with `test`.
- Real unauthenticated `/admin` navigation redirected to sign-in. Real unauthenticated requests to `/api/admin/metrics` and `/api/admin/jobs` returned 401. `/api/health/ready` reported the local DB connected.
- Isolated Playwright fixture tests visited all nine portal sections, verified title/active state/content, direct URLs, back/forward/refresh, desktop/mobile shortcuts, and verification/user-moderation request payloads. These UI workflows used mocked API responses and did not mutate the database.
- Jobs UI fixture test covered active/draft/expired rows, details, a reasoned pause request, expired-job reactivation rejection, and the expired filter.
- Responsive checks covered 320, 360, 390, 430, 768, 1024, 1280, and 1440 px. All nine sections passed at each width before the jobs queue was added; Jobs & Moderation was separately checked at all eight widths after implementation. No document-level horizontal overflow or browser runtime errors were observed.
- ATMOS dark/light switching and reduced-motion signaling were checked in the browser. Sidebar resizing was checked from minimum through middle to maximum, repeated in both directions, with pointer samples, cancellation/lost capture, keyboard adjustment, no text selection, and reload persistence.

## Remaining Limitations

- **P1 — Employer evidence review is incomplete.** There is no protected document storage, permission-checked retrieval, or secure document viewer. The admin API intentionally omits the legacy free-form document URL. Administrators can review submitted fields and record an internal determination, but cannot inspect uploaded evidence. Do not treat the portal as complete for document-based verification until secure storage and access are implemented and tested.
- **P1 — Live workflow persistence is not certified.** No disposable `TEST_DATABASE_URL` was available, so admin job status changes, verification decisions, user moderation, duplicate-submission locking, and audit persistence were not exercised against the database. Browser UI workflows used fixtures; only read-only DB inspection and liveness checks used the configured local database.
- **P2 — Jobs cannot be edited.** Admins can pause, close, or activate supported jobs, but no job-edit/deadline endpoint exists. An expired job is correctly blocked from reactivation until a deadline-edit workflow exists.
- **P2 — Reports are an operational snapshot only.** No date-range analytics, historical aggregates, or export workflow exists; the page identifies itself as a current snapshot.
- **P2 — Browser regression automation is absent.** Existing frontend `auth`, `jobs`, and `applications` specs contain placeholder assertions and no runnable E2E script is defined. The browser checks in this report were manually executed with isolated fixtures, not committed as Playwright tests.
- **P3 — Production performance follow-up.** The main bundle-size warning remains and should be addressed through route/component splitting in a separate performance task.
- Hosted production database, deployment environment, and production security headers/cookie behavior were not tested from this workspace.

## Release Gate

**NOT READY.** The P1 document-access workflow is incomplete and live database persistence could not be certified. The local UI, route protections, API authorization barrier, typecheck, unit suite, production frontend build, and responsive/theme checks passed. Do not claim the employer verification workflow is fully validated or deploy the portal as a complete document-review system until the P1 items are resolved in a safe test environment.