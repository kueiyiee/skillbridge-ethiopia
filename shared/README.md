# Shared layer

The shared layer is the cross-boundary contract set used by both frontend and backend:

- `shared/types/` for application and API contracts
- `prisma/migrations/` for the retained MySQL baseline SQL
- shared runtime constants can be added here as the app expands

This keeps the public contract independent of the browser/server code while preserving the existing root-level migration and hosting constraints.
