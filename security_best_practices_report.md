# Security Best Practices Report

## Executive summary
PlayIMs already has strong core controls (server-side auth/RBAC in `src/hooks.server.ts`, CSRF origin checks, Zod validation, opaque session tokens hashed server-side). As of February 21, 2026, `SBP-003`, `SBP-004`, `SBP-005`, and `SBP-006` have been remediated in code and migrations. The highest remaining risks are still `SBP-001` (prod using dev DB) and `SBP-002` (tenant-route fail-open behavior).

## Critical findings

### SBP-001 - Production bound to development D1 database
- Severity: Critical
- Impact: A production incident or test/migration mistake in the dev DB can directly compromise live customer data confidentiality and integrity.
- Evidence:
  - `wrangler.toml:16`
  - `wrangler.toml:21`
  - `wrangler.toml:22`
- Why this is a gap:
  - Production and development data planes are not isolated.
- Suggested fixes:
  - Move `[env.production]` to the real prod DB binding (`playims-central-db-prod` / prod DB ID).
  - Add CI/deploy guardrails that fail if production points to a `*-dev` DB name or dev DB ID.
  - Run post-deploy smoke checks that verify writes land in prod DB only.

## High findings

### SBP-002 - Tenant route resolution fails open to `central_shared` on missing routing table
- Severity: High
- Evidence:
  - `src/lib/server/database/context.ts:67`
  - `src/lib/server/database/context.ts:145`
  - `src/lib/server/database/context.ts:194`
  - `src/lib/server/database/context.ts:196`
- Why this is a gap:
  - If tenant routing metadata is missing/corrupted, the system silently falls back to shared routing, weakening intended tenant-boundary guarantees.
- Suggested fixes:
  - In production, fail closed (return 503) when `client_database_routes` is missing instead of defaulting.
  - Keep current fallback for local/dev only behind an explicit environment guard.
  - Add alerting/metrics on fallback path usage.

### SBP-003 - CSP applied to APIs only; SSR/HTML responses have no baseline CSP
- Severity: High
- Status: Remediated (February 21, 2026)
- Evidence:
  - `src/hooks.server.ts:510`
  - `src/hooks.server.ts:519`
  - `tests/auth/hooks-security.test.ts:104`
- Remediation:
  - Added a baseline CSP for non-API HTML responses when no CSP is already present.
  - Kept strict API CSP behavior unchanged.
  - Added test coverage asserting CSP is present on protected SSR responses.
- Residual notes:
  - SvelteKit CSP config in `svelte.config.js` remains the primary nonce-based policy for app-rendered pages; hook-level CSP now acts as a safety baseline.

## Medium findings

### SBP-004 - Rate limiting is process-local/in-memory, not globally enforced
- Severity: Medium
- Status: Remediated (February 21, 2026)
- Evidence:
  - `src/lib/database/schema/auth-rate-limits.ts:6`
  - `src/lib/database/operations/auth-rate-limits.ts:16`
  - `src/hooks.server.ts:136`
  - `src/hooks.server.ts:329`
  - `src/lib/database/migrations/0017_cute_prism.sql:16`
- Remediation:
  - Added shared D1-backed rate-limit buckets (`auth_rate_limits`) for cross-instance enforcement.
  - Hooks now consume limits from shared storage first, with local in-memory fallback if DB is unavailable.
  - Added account-identifier throttling (email for login/register, user ID for authenticated flows) in addition to IP throttling.

### SBP-005 - Registration uses one global invite key with immediate active account creation
- Severity: Medium
- Status: Largely remediated for invite-key abuse (February 21, 2026)
- Evidence:
  - `src/lib/database/schema/signup-invite-keys.ts:7`
  - `src/lib/database/operations/signup-invite-keys.ts:37`
  - `src/lib/server/auth/service.ts:270`
  - `src/lib/server/auth/service.ts:412`
  - `src/lib/database/migrations/0017_cute_prism.sql:1`
- Remediation:
  - Replaced env-only invite validation with global DB-backed invite keys (`signup_invite_keys`).
  - Invite keys are now consumed atomically and support `uses` and optional `expires_at`.
  - Legacy env-key validation is retained only as a compatibility fallback when the new table does not yet exist.
  - Operational requirement: at least one invite row must be provisioned in `signup_invite_keys` after migration.
- Residual notes:
  - Accounts are still activated immediately after successful invite registration. Email verification/admin approval is still a future hardening step.

## Low findings

### SBP-006 - Session cookie hardening can be strengthened further
- Severity: Low
- Status: Remediated (February 21, 2026)
- Evidence:
  - `src/lib/server/auth/constants.ts:7`
  - `src/lib/server/auth/session.ts:74`
  - `src/lib/server/auth/session.ts:77`
  - `src/hooks.server.ts:582`
- Remediation:
  - Session cookie name is now `__Host-playims_session` for secure/HTTPS contexts.
  - No `Domain` attribute is used, and `path=/` is preserved.
  - Added legacy cookie fallback (`playims_session`) for local HTTP/dev compatibility and transition safety.
- Residual notes:
  - `SameSite=Lax` remains in place for current login/register UX compatibility; `Strict` can be evaluated later.

## Reference alignment used in this review
- Frontend guidance:
  - `javascript-general-web-frontend-security.md` (`JS-CSP-001`, `JS-CSP-002`)
- Server guidance (adapted to SvelteKit endpoint/action model):
  - `javascript-typescript-nextjs-web-server-security.md` (`NEXT-HEADERS-001`, `NEXT-CSP-001`, `NEXT-AUTH-001`, `NEXT-CSRF-001`, `NEXT-DOS-001`, `NEXT-SESS-001`, `NEXT-SECRETS-001`)
