# Tenancy Architecture

## Overview

PlayIMs now uses a central identity model with tenant-routed domain data:

- **Central DB**: users, sessions, memberships, client metadata, and tenant route records.
- **Tenant DB route**: domain tables resolve per client via `client_database_routes`.

In the current phase, all clients route to `central_shared`, so data still physically lives in one D1 database. The code path is already split so future tenant isolation is a routing change.

## Request Flow

1. `hooks.server.ts` resolves authenticated session using **central DB**.
2. Session provides active client context (`locals.session.activeClientId`).
3. Route handler resolves database access:
   - `getCentralDbOps(event)` for auth/identity/membership flows.
   - `getTenantDbOps(event, clientId)` for domain flows.
4. `getTenantDbOps` looks up `client_database_routes` in central DB.
5. Route mode decides D1 target:
   - `central_shared` => `env.DB`
   - `d1_binding` => `env[ binding_name ]`

## Route Mode Defaults

If no `client_database_routes` row exists for a client, routing defaults to `central_shared`. The helper can lazily ensure a default route row.

## Slug Join Flow

- Public org landing route: `/<client-slug>`.
- Authenticated join endpoint: `/api/auth/join-client`.
- Join is allowed only when `clients.self_join_enabled = 1`.
- Join sets active and default client membership immediately for the current session.

## Deprecation: `users.client_id`

`users.client_id` remains in schema temporarily for compatibility, but runtime auth/membership logic now relies on `user_clients`.

Planned follow-up:

1. Run with deprecated column unused for one stable release.
2. Drop `users.client_id` in a dedicated migration.
3. Remove leftover compatibility references in seed/docs.

## Future Isolation Cutover Checklist

1. Provision tenant D1 per client.
2. Add Cloudflare binding(s) for tenant DBs.
3. Insert/update `client_database_routes` rows to `route_mode='d1_binding'`.
4. Run tenant schema migrations against target tenant DB.
5. Backfill client tenant-domain rows from central store as needed.
6. Flip route to active tenant binding and verify smoke flows.
