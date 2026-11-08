# Dashboard notifications and communication workflow

## Shared application communication

SKILLBRIDGE uses application-linked conversations as the source of truth for recruitment communication. A conversation belongs to a job application and is visible only to its candidate and the verified employer that owns the job. The messaging API authenticates the caller, checks the role, and enforces application-participant ownership before returning a conversation or accepting a message.

The notification center does not create a second message store. It summarizes the existing application-message threads, unread counts, latest message preview, job title, participant, and last activity time. Opening the notification center routes the user to the existing Messages workspace, where the conversation is loaded and incoming messages are marked read by the existing backend workflow.

## Dashboard behavior

- Job Seeker: sees employer-originated application activity and can open Messages & Opportunities.
- Employer: sees candidate activity for its own applications. Messaging notifications are enabled only after the employer is approved.
- Admin: receives a governance shortcut to the audit log. The admin UI intentionally does not expose private candidate-employer message content.

## Refresh strategy

The notification center refreshes its thread summary every 20 seconds while the page is visible. Open candidate and employer conversations refresh every 15 seconds while visible. The refresh loop pauses while the browser tab is hidden and resumes when it becomes visible. This provides near-real-time updates without introducing a WebSocket server, connection lifecycle, or deployment dependency.

The UI retains the last successfully loaded conversation if a background refresh fails. Sending messages and answering interview invitations continues to use the existing authenticated write endpoints.

## Security and privacy boundaries

- Client-side role visibility is not an authorization boundary.
- Server-side authentication, role middleware, employer verification middleware, and application participant checks remain authoritative.
- Admin does not join application conversations and cannot use the candidate or employer message routes.
- Notification previews are limited to conversations already returned by the caller's authorized thread endpoint.
- Admin activity review is through the existing audit-log API, not private message inspection.

## Verification still required

Run the repository's TypeScript/lint, unit, frontend production build, server build, and MySQL integration workflows in CI. Then manually verify notification refresh across two authenticated test accounts, unread count transitions, interview responses, mobile layouts, hidden-tab pause/resume, and unauthorized application IDs. Polling is near-real-time, not instant push delivery; a future WebSocket/SSE transport should be introduced only with an authenticated connection design and deployment support.
