# OpenGPS Code Quality Conventions

This document records the conventions used when reviewing and extending the reports feature.

## Backend

- Keep business rules in `backend/internal/app` and external concerns in PostgreSQL and HTTP adapters.
- Define interfaces in the package that consumes them.
- Apply device authorization in SQL through `user_device_access` and exclude deleted devices and grants.
- Use parameterized queries, propagate request contexts, wrap errors with operation context, and never ignore serialization errors.
- Do not calculate reports from silently truncated datasets. Export limits must be explicit errors.
- Preserve nullable telemetry values as null in API responses.

## Frontend

- Keep API calls in `frontend/src/lib/api/services` and keep React components focused on presentation and interaction.
- Use strict TypeScript, type-only imports, named exports, explicit prop interfaces, and type guards instead of assertions.
- Keep visible strings in both locale files and use the translation object for every user-facing label.
- Preserve grouped imports and the existing component naming conventions.
- Use `PUBLIC_API_URL` consistently for API requests and downloads.
- Document exported components, prop interfaces, and service functions with JSDoc.

## Verification

Run these commands before committing when the required tools are available:

```text
CGO_ENABLED=0 go test ./...
CGO_ENABLED=0 go build ./...
cd frontend && pnpm format
cd frontend && pnpm lint
cd frontend && pnpm test
cd frontend && pnpm astro check
cd frontend && pnpm build
```

Database end-to-end checks require a running PostgreSQL instance. Keep that limitation explicit rather than substituting a unit-test result.

## Commit organization

Use English Conventional Commit messages. Prefer separate commits for backend implementation, frontend implementation, tests, documentation, and focused refactors. Do not include unrelated working-tree changes.
