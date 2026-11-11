# SKILLBRIDGE API Inventory

Base path: `/api`. The frontend uses same-origin requests through `src/services/api-client.ts`. API handlers use the shared Drizzle-backed SQL adapter in `backend/src/infrastructure/database/drizzle.ts`; they do not use the removed mock repository. Database changes are not applied automatically.

Status codes below describe intended handler behavior. Validation failures generally return `400`, missing records `404`, unauthenticated requests `401`/`403`, and unexpected or unavailable database/service operations `500`/`503`.

| `GET /api/report-verification/:reportId` | Public, rate-limited | Returns limited issuance metadata, current validity status, and the report-data SHA-256 fingerprint. Does not return report rows or private employer data. |

## Health and system

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/health` | Public | Liveness only. Returns API status and timestamp; does not claim database readiness. |
| `GET /api/health/ready` | Public | Executes `SELECT 1`; returns `200 ready` or `503 not_ready`. |
| `GET /api/system/status` | `ADMIN` | Legacy detailed diagnostics endpoint; requires administrator authorization. Returns database engine/version and table counts; use `/api/admin/diagnostics` for the admin dashboard. |
| `GET /api/system/skills` | Public | Reads the skill catalog from `skills`, ordered by demand and name. |

## Authentication and account

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `POST /api/auth/register` | Public, rate-limited | Accepts only `JOB_SEEKER` and `EMPLOYER`. Creates or resumes an inactive pending account and sends a six-digit OTP through Resend. Returns a generic response to avoid account enumeration and sets an HttpOnly verification-session cookie, not an authenticated session. |
| `GET /api/auth/email-verification` | Pending verification cookie | Returns the masked destination and resend timing; it does not reveal a code or account identifier. |
| `POST /api/auth/email-verification/resend` | Pending verification cookie; IP and account rate-limited | Invalidates the prior OTP and sends a replacement after the cooldown. |
| `POST /api/auth/email-verification/verify` | Pending verification cookie; IP and attempt rate-limited | Accepts a six-digit code. On success, atomically marks the account email-verified and active, invalidates the challenge, and sets the authenticated session cookie. |
| `POST /api/auth/login` | Public, rate-limited | Accepts email or administrator username and password. Invalid credentials remain generic; a correct password for a pending email receives a verification-required response and no session. Password hashes and JWTs are not returned. |
| `GET /api/auth/me` | Authenticated session | Checks session revocation and reloads the active, email-verified user and role from MySQL before returning identity plus the caller's own profile. |
| `PATCH /api/auth/me` | Authenticated session | Validates at least one bounded `fullName`/`phone` field and updates only the caller's account. |
| `POST /api/auth/change-password` | Authenticated session; rate-limited | Requires the current password and matching new-password fields. New passwords must be at least 12 characters and no more than 72 UTF-8 bytes. Updates the bcrypt hash transactionally, revokes the current session, and returns a refreshed HttpOnly session cookie. |
| `DELETE /api/auth/me` | Authenticated session | Requires current password. Removes caller-owned related records and user in a transaction, writing the audit record before deletion so its user foreign key can become null. |
| `POST /api/auth/logout` | Public | Clears the HttpOnly cookie and persistently revokes the session until expiry. Returns `503` if revocation cannot be stored. |

## Jobs

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/jobs` | Public; optional bearer token | Filters active jobs by query, city, type, skill, and minimum salary. Reads jobs and requirements; returns `{ success, count, data }`. Pagination is not currently implemented. |
| `GET /api/jobs/:id` | Public for active jobs; owner/admin can see own non-active jobs | Reads one job and requirements and increments its view count. Hidden/non-owned inactive jobs return `404`. |
| `POST /api/jobs` | `EMPLOYER` | Validates job and skill requirements. Creates job, missing skill catalog entries, requirement links, and audit row in one transaction. Returns `201`; the employer identity is derived from the token, not the request body. |
| `PATCH /api/jobs/:id` | Verified `EMPLOYER`, owner only | Validates and replaces the editable posting fields and skill requirements; updates only the caller's job. |
| `PATCH /api/jobs/:id/status` | Verified `EMPLOYER`, owner only | Accepts `ACTIVE`, `PAUSED`, or `CLOSED`; verifies ownership and updates status. Pausing or closing writes private updates to eligible applicants and an audit event transactionally. Repeating the current status does not resend notifications. |
| `POST /api/jobs/:id/apply` | `JOB_SEEKER` | Validates optional cover note, requires active job and caller's profile, checks duplicate application, calculates match, then writes application and skill-gap result transactionally. Duplicate returns `409`. |
| `POST /api/jobs/:id/save` | `JOB_SEEKER` | Inserts a caller-owned saved-job row; unique conflict is idempotently ignored. |
| `DELETE /api/jobs/:id/save` | `JOB_SEEKER` | Deletes only the caller's saved-job row; repeat delete is idempotent. |
| `POST /api/jobs/:id/analyze-gap` | `JOB_SEEKER` | Validates optional weights in `[0,1]`; derives candidate profile from the bearer token and computes matching against active job data. No demo profile fallback. |

## Candidate

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/candidates/me` | `JOB_SEEKER` | Reads only the caller's profile and skills. |
| `PATCH /api/candidates/me` | `JOB_SEEKER` | Validates non-empty profile fields and updates only the caller's profile. |
| `POST /api/candidates/me/skills` | `JOB_SEEKER` | Validates a skill, creates catalog entry if needed, and upserts the caller's proficiency/experience. |
| `DELETE /api/candidates/me/skills/:id` | `JOB_SEEKER` | Deletes a skill only if it belongs to the caller; returns `404` when absent/not owned. |
| `GET /api/candidates/me/applications` | `JOB_SEEKER` | Lists only the caller's applications and associated public job/employer information. |
| `GET /api/candidates/me/saved-jobs` | `JOB_SEEKER` | Lists only the caller's saved jobs. |
| `GET /api/candidates/me/recommendations` | `JOB_SEEKER` | Computes explainable recommendations from active jobs and the caller's profile. Results are computed live; this endpoint does not persist `Recommendation` rows. |
| `GET /api/candidates/me/learning-path` | `JOB_SEEKER` | Aggregates missing skills across a limited set of active jobs. Computed response; no assessment or roadmap record is written. |

## Application messaging

Conversations are scoped to an existing job application. Employers must be verified and may contact only applicants to their own jobs. Messages do not reveal candidate email, phone, or private profile fields. Application-stage changes create a candidate-visible notification in the same transaction as the status update.

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/messages/candidate/threads` | `JOB_SEEKER` | Lists the caller's application conversations and unread count. |
| `GET /api/messages/candidate/threads/:applicationId` | `JOB_SEEKER`, application owner | Marks incoming messages read and returns the application context and message history. |
| `POST /api/messages/candidate/threads/:applicationId` | `JOB_SEEKER`, application owner | Sends a bounded reply to the employer attached to the application. |
| `POST /api/messages/candidate/threads/:applicationId/respond/:messageId` | `JOB_SEEKER`, invitation recipient | Accepts or declines a pending interview invitation and records the response in the conversation. |
| `GET /api/messages/employer/threads` | Verified `EMPLOYER` | Lists conversations for the employer's own applicant records, with unread counts. |
| `GET /api/messages/employer/threads/:applicationId` | Verified `EMPLOYER`, application owner | Marks incoming messages read and returns the application context and conversation history. |
| `POST /api/messages/employer/threads/:applicationId` | Verified `EMPLOYER`, application owner; limited to 60 per 15 minutes | Sends a private message, future-dated interview invitation, or information/assessment request. Shortlisting must use the application status endpoint; a message alone never changes hiring status. |
| `POST /api/messages/employer/bulk` | Verified `EMPLOYER`; limited to 10 per hour | Sends one private copy to each distinct eligible application (maximum 100), scoped to the caller's jobs. Requires a UUID request ID; matching retries return the prior result and mismatched retries are rejected. Returns per-recipient delivery results without exposing recipients to one another. |

## Employers

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/employers` | Public | Lists approved employers and public organization fields only; TIN, license, and user identifiers are excluded. |
| `GET /api/employers/me` | `EMPLOYER` | Reads caller's organization, latest verification, and own jobs. |
| `POST /api/employers/me/verify` | `EMPLOYER` | Validates TIN/license input; records verification, updates employer profile, and writes audit row transactionally. |
| `GET /api/employers/me/applications` | Verified `EMPLOYER` | Lists applications only for jobs owned by the caller; candidate profile and contact fields are filtered by profile visibility and contact preferences. |
| `PATCH /api/employers/me/applications/:id/status` | Verified `EMPLOYER`, application owner | Applies only permitted forward transitions (`APPLIED`/`SCREENING` → review stages; `OFFERED` → `HIRED` or `REJECTED`; terminal statuses cannot transition). Updates the application, writes the candidate notification, and records an audit event in one transaction. |
| `GET /api/employers/me/analytics` | Verified `EMPLOYER` | Computes metrics from the caller's jobs and applications. No other employer's records are selected. |\n| `GET /api/employers/me/verification/documents` | `EMPLOYER` | Lists the caller's documents for the latest active verification record; response is not cacheable. |\n| `POST /api/employers/me/verification/documents` | `EMPLOYER`; 20/hour | Accepts a base64 PDF/JPG/PNG up to 4 MB, checks the file signature against the declared type, writes to private storage, and records an audit event. The upload rate limit is stored in MySQL and shared across workers. |\n| `GET /api/admin/verifications/employers/:employerId/documents` | `ADMIN` | Lists verification documents for the selected employer without exposing storage paths. |\n| `GET /api/admin/verifications/employers/:employerId/history` | `ADMIN` | Lists the employer's verification decision history. |\n| `PATCH /api/admin/verifications/documents/:documentId` | `ADMIN`; rate-limited | Records an approval, rejection, or resubmission request with reviewer and audit metadata. |\n| `GET /api/admin/verifications/employers/:employerId/documents/:documentId` | `ADMIN` | Streams a private document with no-store, nosniff, and sandbox CSP headers; access outcome is audited. |

Bulk messaging supports one candidate, selected candidates, or applicants to one employer-owned job through a common application-ID API. Each recipient receives a separate application-linked message. Organization-wide announcements are not supported because the current data model has no candidate opt-in record.

## Administration

All `/api/admin/*` routes require a valid token with `ADMIN` role.

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/admin/verifications` | `ADMIN` | Supports bounded pagination, organization/contact/record search, and status filters. Returns current reviewer and timestamps; omits the legacy free-form document URL because protected document storage is not configured. |
| `PATCH /api/admin/verifications/:id` | `ADMIN`, rate-limited | Validates record ID, review status, and bounded notes; locks the record, prevents changes after final approval/rejection, updates employer approval and reviewer/timestamp, and records a sanitized audit event in one transaction. |
| `GET /api/admin/manage/:entity` | `ADMIN` | Lists paginated users, employers, jobs, verifications, or applications; supports text search and explicit archived-record inclusion. |
| `GET /api/admin/manage-options` | `ADMIN` | Returns bounded employer, job, and candidate choices for record relationships. |
| `POST /api/admin/manage/:entity` | `ADMIN`, rate-limited | Creates validated records; account passwords are hashed server-side, admin accounts cannot be created here, and writes are audited. |
| `PUT /api/admin/manage/:entity/:id` | `ADMIN`, rate-limited | Validates and edits allowed account, employer, job, verification, or application fields; prevents publishing expired jobs or jobs for unapproved employers, and audits changes. |
| `DELETE /api/admin/manage/:entity/:id` | `ADMIN`, rate-limited | Soft-archives the record without deleting linked jobs, applications, verification decisions, or audit history. The final active administrator and the current administrator cannot be archived. |
| `POST /api/admin/manage/:entity/:id/restore` | `ADMIN`, rate-limited | Restores an archived record without overwriting its prior status; the operation is audited. |
| `GET /api/admin/users` | `ADMIN` | Supports bounded pagination, account search, role/status filters, and returns only approved identity/status fields; excludes password hashes. |
| `PATCH /api/admin/users/:id/moderate` | `ADMIN`, rate-limited | Requires boolean `isActive` and a 3-500 character reason; prevents self-suspension and suspension of the last active admin; updates an existing user and writes an audit event atomically. Missing users return `404`; protected conflicts return `409`. |
| `GET /api/admin/jobs` | `ADMIN` | Supports bounded pagination, job/employer search, and DRAFT/ACTIVE/PAUSED/CLOSED/EXPIRED filtering. Expiration is derived from the deadline without changing the stored status; includes employer approval and applicant count. |
| `PATCH /api/admin/jobs/:id/moderate` | `ADMIN`, rate-limited | Accepts ACTIVE/PAUSED/CLOSED and a 3-500 character reason; locks the job and writes the status change and audit event atomically. Expired jobs and jobs for unapproved employers cannot be published; deadline editing is available through Data Management. |
| `GET /api/admin/audit-logs` | `ADMIN` | Supports bounded pagination, search, action-type, and date-range filters; returns selected audit fields and actor identity, never credentials or auth headers. |
| `GET /api/admin/metrics` | `ADMIN` | Returns real role/status-aware database aggregates. Average match score is `null` when no persisted scores exist; the UI reports `N/A`. |
| `GET /api/admin/diagnostics` | `ADMIN` | Returns database health, engine/version, read-only migration-ledger state, table counts, app timestamp, and AI-provider model-access status without credentials. Overall status is degraded when required tables/migrations or a configured provider are unavailable. It provides no mutation/reset operations. |

## Evaluations

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/evaluations` | Bearer token; scoped by role | Employers see their own evaluations; job seekers see evaluations about their profile; admins can see all. |
| `POST /api/evaluations` | `EMPLOYER` | Validates score fields and verifies job ownership and candidate existence; writes evaluation and audit row transactionally. |

## AI Nexus and AI utilities

| Method and path | Access | Request, persistence, and response |
|---|---|---|
| `GET /api/ai/nexus/conversations` | Bearer token | Lists only caller-owned conversations (up to 20). |
| `GET /api/ai/nexus/conversations/:id` | Bearer token, owner only | Returns one caller-owned conversation and messages; missing/other-user IDs return `404`. |
| `POST /api/ai/nexus/query` | Bearer token; rate-limited | Validates message length, scopes grounding by the authenticated role, persists messages/conversations, and uses Gemini when configured or deterministic fallback otherwise. |
| `DELETE /api/ai/nexus/conversations/:id` | Bearer token, owner only | Deletes only caller-owned conversation; deletion is idempotent. |
| `POST /api/ai/skill-gap-advisor` | `JOB_SEEKER`; rate-limited | Accepts a target role and optional active `jobId`; profile, skills, and job gap are read from MySQL. Gemini is optional; deterministic guidance is labeled. No client-supplied profile/score is trusted. |
| `POST /api/ai/job-enhancer` | `EMPLOYER`; rate-limited | Validates title/description and returns AI-generated or labeled deterministic job-writing suggestions. Does not write or publish a job. |

## Known API gaps and limitations

- The legacy schema reference and checked-in MySQL baseline do not prove the exact schema currently installed on a hosting account. Hosted columns, constraints, enums, indexes, migration ledger, and data integrity remain unverified until a production-safe read-only inspection is completed.
- `SkillAssessment` has no public assessment API or complete frontend assessment workflow.
- Recommendations and learning paths are computed live; the `Recommendation` table is not populated by those endpoints. Skill-gap results are persisted when an application is submitted, not for every analysis request.
- There is no backend job-edit/deadline endpoint, persisted session-revocation UI, or automated browser E2E suite. The files under `frontend/e2e/` are placeholder blueprint tests and are not run by CI.
- Login, password recovery, registration, AI requests, password changes, email-verification requests/attempts, and employer document uploads use the shared MySQL rate-limit table. Some feature-specific limits elsewhere still use the default in-memory store and therefore are per process.
- Verification document upload validates file size, base64 encoding, file signature, and declared content type, and stores files privately. **Antivirus/malware scanning is not implemented**; do not describe file-signature validation as malware protection.
- No strict application-wide Content Security Policy is configured. Add CSP only after inventorying inline scripts, Vite/production asset origins, fonts, and any required provider endpoints; deploy in report-only mode before enforcement.
- The Python `ml_service/` is not called by the current API. Matching uses the deterministic TypeScript implementation.
- Production cPanel connectivity, reverse-proxy behavior, TLS/HSTS, cookie behavior, file-storage permissions, backup/restore, monitoring, and live smoke tests have not been verified from CI.
- No production data migration or live production deployment has been performed by this repository audit.
