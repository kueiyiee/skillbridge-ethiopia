# Dashboard design system

SKILLBRIDGE ET has three role-specific workspaces with one shared visual and interaction foundation.

## Role boundaries

- **Job Seeker — Career Workspace:** career profile, skill evidence, explainable job recommendations, applications, saved opportunities, messages, and learning progress.
- **Employer — Recruitment Workspace:** organization verification, vacancies, applicant pipeline, candidate discovery, interviews, messages, and hiring analytics.
- **Administrator — Governance Workspace:** employer verification decisions, user and job moderation, audit history, reports, and operational diagnostics.

Role-specific navigation and capabilities must remain distinct. Shared presentation components must never become a substitute for backend authorization.

## Shared components

The reusable primitives live in `src/components/shared/DashboardPrimitives.tsx`.

- `DashboardPageHeader` standardizes page eyebrow, title, description, and action placement.
- `DashboardMetricCard` standardizes metric hierarchy and card spacing. It renders a native button when an action is supplied and a semantic article otherwise. Optional progress uses accessible progressbar attributes.

The Job Seeker, Employer, and Admin overview metrics now use the shared metric component. Employer and Admin page headings use the shared page header.

## Responsive navigation

- Job Seeker and Employer workspaces provide horizontally scrollable, keyboard-accessible mobile navigation.
- Their desktop sidebars remain in place on large viewports.
- Admin retains its dedicated responsive governance navigation and mobile dialog behavior.

Keep mobile navigation labels visible, provide focus indicators, expose the current section with `aria-current="page"`, and do not hide backend-unavailable sections behind misleading active controls.

## Visual and interaction standards

- Preserve the SKILLBRIDGE navy/cyan visual identity and ATMOS light/dark theme support.
- Use consistent spacing, typography hierarchy, borders, focus rings, and semantic status colors.
- Use native buttons for actions and native form controls for input.
- Give meaningful accessible names to icon-only controls and progress indicators.
- Provide loading, empty, error, and success states. Never represent failed data retrieval as a genuine zero.
- Keep data and authorization decisions in backend services. UI state is not a security boundary.

## Quality gates

Before merging dashboard changes:

1. Run `npm run lint`.
2. Run `npm test`.
3. Run `npm run build`.
4. Verify all three role dashboards at mobile, tablet, and desktop widths.
5. Test keyboard-only navigation, focus visibility, screen-reader labels, loading and API failure states.
6. Verify candidate, employer, and administrator permissions with backend tests and authenticated end-to-end workflows.

This document describes implemented shared UI foundations and expected quality gates. It does not certify production deployment, accessibility conformance, security, or performance.
