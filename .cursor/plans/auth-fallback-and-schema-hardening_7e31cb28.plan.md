---
name: auth-fallback-and-schema-hardening
overview: Address anonymous fallback risk, dev UX without Clerk, and enforce non-null user IDs in schema
todos:
  - id: remove-anon-fallback
    content: Replace anonymous fallback and update server usage
    status: completed
  - id: dev-mode-auth-handling
    content: Let app run without Clerk in dev with clear banner
    status: completed
  - id: enforce-userid-not-null
    content: Make userProfiles.userId notNull and migrate
    status: completed
  - id: check-impacts-tests
    content: Audit inserts/migration data and add checks/tests
    status: completed
---

# Fix Auth Fallback, Dev UX, and userId Constraint

1) Replace shared anonymous fallback

- Update `server/constants.ts` to remove hard-coded `"anonymous"` fallback; decide on requiring auth or using per-session/temp IDs.
- Adjust any server code paths that currently rely on `DEFAULT_USER_ID` to avoid cross-user data leakage.

2) Allow dev flow without Clerk blocking app load

- Update `client/src/main.tsx` to support a dev-friendly mode when `VITE_CLERK_PUBLISHABLE_KEY` is missing (e.g., render app with a mock provider or explicit dev banner) while keeping production strict.
- Document/flag clearly in UI/logs that auth is disabled in this mode.

3) Enforce non-null userId in DB schema

- Change `userProfiles.userId` to `.notNull()` in `shared/schema.ts` and ensure migrations are updated to enforce NOT NULL.
- Scan for any insert code paths that might omit `userId` and adjust to provide required value.

4) Validate impacts and add safeguards

- Check for existing data that may violate new NOT NULL constraint and plan migration strategy.
- Add minimal tests/checks if present (e.g., schema validation) to catch missing userId or unauthenticated access paths in dev mode.