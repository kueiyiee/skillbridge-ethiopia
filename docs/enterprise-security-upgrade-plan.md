# SKILLBRIDGE ET — Enterprise Dashboard and Security Upgrade Plan

## Scope

Upgrade the three existing role workspaces without replacing the current application architecture:

- Job Seeker — Career Intelligence Workspace
- Employer — Talent & Recruitment Workspace
- Administrator — Governance & Security Workspace

The active application is the root React/Vite frontend, the Express modular monolith under `backend/src`, and MySQL through Drizzle. Do not migrate the active frontend into the planning-only `frontend/` directory or split the backend into microservices as part of this initiative.

## Repository baseline observed

- The three role dashboards already exist and share a dashboard design foundation.
- The administrator API already exposes role-protected audit logs, platform metrics, and system diagnostics.
- The login flow currently authenticates with a password after email verification and issues the application session. Email registration OTP is not a second login factor.
- The current account security page supports password changes; MFA enrollment and passkey management are not yet exposed by the current authentication routes.
- Employer verification documents are stored privately and checked for type/signature/size, but the architecture documentation explicitly records that malware scanning is not configured.

These are implementation observations, not a security certification.

## Dashboard product direction

### Job Seeker — Career Intelligence

Prioritize a clear career command center:
- Profile completion and verified skill evidence.
- Explainable job matches and skill-gap recommendations.
- Application pipeline with next actions and communication.
- Saved opportunities and learning roadmap.
- Account privacy, active sessions, MFA and passkey management.
- Clear loading, empty, error, and stale-data states.

### Employer — Talent & Recruitment

Prioritize recruitment operations:
- Organization verification state and required next steps.
- Vacancy performance and applicant pipeline.
- Candidate discovery with permission-aware profile visibility.
- Interview scheduling, application-linked messaging, and hiring analytics.
- Team roles and least-privilege permissions where multi-user organizations are supported.
- Account privacy, active sessions, MFA and passkey management.

### Administrator — Governance & Security

Prioritize accountable operations:
- Employer verification and user/job governance.
- Security Intelligence Center backed by persisted audit events and real diagnostics.
- Audit history, incident workflow, service health and report exports.
- Privileged-action reauthentication and administrator MFA/passkey enforcement.
- Never display fabricated threat counts, risk scores, geolocation, or monitoring status.

## Authentication architecture

Implement MFA centrally in the shared authentication module. Do not build separate authentication systems for each dashboard.

### Supported authenticators

1. **TOTP authenticator app** for a standards-based second factor, with one-time recovery codes.
2. **WebAuthn/passkeys** for phishing-resistant authentication with platform biometrics, device PIN, or security keys.
3. **Email OTP** remains an account-verification/recovery channel, not the sole MFA factor for privileged access.

### Role policy

- Job Seekers: password + optional TOTP/passkey; encourage passkey enrollment.
- Employers: require MFA before organization-sensitive operations; passkey preferred.
- Administrators: require MFA; prefer passkeys or hardware security keys, with documented recovery procedures.

### Biometric privacy

Use WebAuthn user verification. Fingerprint or face recognition occurs locally in the device authenticator. Store only credential public keys and protocol metadata on the server; never collect or store fingerprint templates or face images.

### Required backend controls

- Enrollment requires recent reauthentication.
- TOTP secrets are encrypted at rest and never returned after enrollment.
- Recovery codes are high entropy, one-time use, and stored as hashes.
- Passkey registration and assertion challenges are cryptographically random, short-lived, single-use, and bound to the expected RP ID/origin.
- Validate challenge, origin, RP ID hash, signature, credential ownership, user-presence and user-verification requirements server-side.
- Rotate the session after MFA completion; revoke or invalidate pre-authentication sessions.
- Require step-up authentication for password/email changes, MFA removal, passkey removal, administrator privilege changes, and sensitive verification decisions.
- Add rate limits, replay protection, audit events, account recovery controls, and tests for enrollment, verification, revocation, and bypass attempts.
- Do not mark a user as MFA-enabled until the factor has been successfully verified.

## Security Intelligence Center

The initial administrator UI visualizes existing persisted audit records and service diagnostics. It explicitly does not claim to be a SIEM or IDS.

Future backend-backed modules:
- Authentication success/failure and MFA events.
- Session creation, revocation, and suspicious session changes.
- Role/permission and privileged-action changes.
- Rate-limit and abuse events.
- Security incidents with severity, owner, status, evidence, and resolution history.
- Vulnerability and dependency scan findings.
- Upload quarantine and malware-scan outcomes.

Every count must come from a defined backend query and time window. Missing data must render as unavailable, never as zero.

## Verified report issuance and printed verification

The first reporting implementation now uses a shared issued-report registry:
- PDF exports from Admin and verified Employer workspaces issue a cryptographically random report reference.
- The registry stores issuer role, owner scope, report type/title, issue time, record count, status, and a SHA-256 fingerprint of the report data. It does not store exported personal records.
- A4 PDF files include a QR link to the public report-verification page and a Code 39 barcode containing the report reference.
- Public verification returns only limited issuance metadata and the report-data fingerprint; it does not expose the report rows or private organization data.
- A revoked status is represented in the registry and verification response. Revocation administration still requires a protected governance workflow.
- The QR link uses the existing `APP_URL` environment variable. It must be a valid absolute public origin and HTTPS in production.
- Apply the `20261112000100_verified_report_registry` migration with `npm run db:migrate` before enabling PDF exports.

The printed QR verifies the issued registry record and its data fingerprint. It does not, by itself, prove that a separately modified PDF file is unchanged; the printed report ID and SHA-256 fingerprint must be compared with the verification response.

## Delivery sequence

1. Establish baseline screenshots, route inventory, current test/build results, and responsive/accessibility checks for all three dashboards.
2. Ship the Security Intelligence Center using existing admin-only audit and diagnostics APIs.
3. Implement TOTP and recovery codes in the central auth module with database migrations and integration tests.
4. Implement WebAuthn/passkeys using a maintained, reviewed library; update package lockfiles and deployment requirements.
5. Add consistent security settings and session-management entry points to all three workspaces.
6. Enforce role-based MFA policy and step-up authentication on sensitive actions.
7. Add CI security scanning, dependency review, secret scanning, and authorized DAST tests.
8. Verify all workflows against OWASP ASVS 5.0.0 and publish an evidence-based security report.

## Release gates

- No dashboard-only or client-only authorization.
- No biometric data stored by SKILLBRIDGE.
- No fake SOC alerts, risk scores, or security posture percentages.
- Database migrations are backward-compatible, explicit, and tested against disposable MySQL.
- Existing login, email verification, employer verification, applications, messaging, AI Nexus, and deployment workflows continue to pass.
- Run `npm run lint`, `npm test`, `npm run build`, and the MySQL integration suite in an environment with the required test database before merge.
- Do not describe the platform as certified, penetration-tested, or production-secure without independent evidence.
