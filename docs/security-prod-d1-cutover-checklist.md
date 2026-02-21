# Production D1 Isolation Cutover Checklist

Purpose: move PlayIMs production traffic off `playims-central-db-dev` and onto `playims-central-db-prod` with minimal risk.

## Scope
- Runtime: Cloudflare Pages/Workers (`wrangler.toml`)
- Database: D1 central auth + tenant-routed domain data
- Current state: `env.production` points to `playims-central-db-dev`

## 1. Pre-cutover preparation
- [ ] Pick a maintenance window and announce it to stakeholders.
- [ ] Freeze schema-changing merges during the cutover window.
- [ ] Verify local and remote migration history are clean:
  - `pnpm db:generate` (no pending diffs expected)
  - `pnpm db:migrate:remote` (targeting intended database)
- [ ] Confirm you have current Cloudflare credentials available for emergency rollback.
- [ ] Export a backup/snapshot of current production-facing data from the dev DB.
- [ ] Prepare a rollback note with exact previous `wrangler.toml` production D1 binding values.

## 2. Provision and align production DB
- [ ] Ensure `playims-central-db-prod` exists and is accessible.
- [ ] Apply all required migrations to prod DB:
  - `pnpm db:migrate:remote` (with prod DB target configured)
- [ ] Run integrity checks on prod DB:
  - required tables exist (`users`, `sessions`, `user_clients`, `client_database_routes`, domain tables)
  - expected indexes/constraints exist (email uniqueness, token hash uniqueness, membership uniqueness).

## 3. Data copy and verification
- [ ] Copy live data from current prod-facing dev DB into prod DB.
- [ ] Verify row-count parity for critical tables:
  - `clients`, `users`, `user_clients`, `sessions` (active only), `seasons`, `offerings`, `leagues`, `divisions`, `teams`.
- [ ] Verify critical references:
  - all `sessions.user_id` and `sessions.client_id` references resolve
  - all `user_clients.user_id` and `user_clients.client_id` references resolve
  - `client_database_routes` rows present for active clients.

## 4. Configuration cutover
- [ ] Update `wrangler.toml` production binding to:
  - `database_name = "playims-central-db-prod"`
  - `database_id = "b20ff0a2-3fac-4645-a45a-bd7de64ec2a3"`
- [ ] Keep development binding unchanged.
- [ ] Deploy to production.

## 5. Post-cutover smoke tests
- [ ] Authentication:
  - login succeeds
  - register/invite flow behaves as expected
  - session endpoint returns memberships.
- [ ] Tenant context:
  - switch organization works
  - join organization honors `self_join_enabled`.
- [ ] Domain workflows:
  - create/update facility
  - create/update season
  - read dashboard data.
- [ ] Verify write operations appear only in prod DB, not dev DB.

## 6. Rollback plan (if any critical check fails)
- [ ] Revert `wrangler.toml` production D1 binding to previous dev DB values.
- [ ] Redeploy immediately.
- [ ] Re-run smoke tests.
- [ ] Capture failure root cause before attempting a second cutover.

## 7. Hardening follow-ups after successful cutover
- [ ] Add a CI guard that blocks production deploys if `env.production` points at dev DB.
- [ ] Add a startup/runtime health check that logs active DB binding and environment.
- [ ] Add a release checklist item requiring explicit DB target verification before deploy.
