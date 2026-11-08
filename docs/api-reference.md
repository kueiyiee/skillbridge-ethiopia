# API Reference

All routes use the `/api` prefix and return JSON. Login and registration set a short-lived HttpOnly session cookie, which the browser sends automatically on same-origin requests. Request/response details, roles, validation, and persistence are documented in the [API inventory](API_INVENTORY.md), which is the source of truth for implemented endpoints.

## Route Families

| Mount | Feature | Access overview |
|---|---|---|
| `/api/health`, `/api/health/ready` | Liveness and MySQL readiness | Public; ready endpoint runs `SELECT 1` |
| `/api/auth` | Registration, login, current account, logout | Login/register public; profile operations token-authenticated |
| `/api/jobs` | Public discovery, job posting/status, application, saved jobs, matching | Public reads; mutations protected by role and ownership |
| `/api/candidates` | Candidate profile, skills, applications, recommendations, learning path | Job seeker only; data scoped to authenticated profile |
| `/api/employers` | Public approved directory, employer profile, verification, applicant pipeline, analytics | Employer operations require employer role and ownership |
| `/api/admin` | Verification, user moderation, audit logs, metrics | Admin role required for all routes |
| `/api/evaluations` | Performance reviews | Token required; reads role-scoped, writes employer-only |
| `/api/ai` | AI Nexus, skill advisor, job-description enhancer | Token and role required; rate-limited |
| `/api/system` | Database diagnostics and skill catalog | Public; sensitive credentials are never returned |

## Contracts

Shared environment-independent domain/request types live in `shared/types/`. Runtime Zod validation lives in `backend/src/validation/schemas.ts`. The frontend request helper at `src/services/api-client.ts` throws on HTTP failures and explicit unsuccessful JSON payloads.
The backend re-reads the active role from MySQL and checks session revocation on authenticated requests. Never treat frontend role navigation or IDs as authorization. See [docs/API_INVENTORY.md](API_INVENTORY.md) for every implemented method/path and known functionality gaps.

## Limitations

No assessment endpoints or persistent notification API currently exist. Recommendations and learning paths are computed on request, not stored as rows. Pagination and a backend job-edit endpoint are not implemented.
