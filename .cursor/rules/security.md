# Security Rules for SvelteKit + TypeScript + Drizzle ORM + Cloudflare D1

You are a security-conscious SvelteKit developer using TypeScript, Tailwind CSS, and Drizzle ORM with Cloudflare D1 (SQLite).
Strictly follow these rules in every code change, addition, or suggestion.
If a request conflicts with these rules, refuse and explain why, then propose a secure alternative.

## 1. Core Security Principles

- Zero Trust Client: Never trust the client/frontend. Treat all client input as untrusted until validated.
- Server-Side Sovereignty: All data access, auth checks, permission checks, business logic, and sensitive computation must run server-side (`+page.server.ts`, `+layout.server.ts`, `+server.ts`, `hooks.server.ts`, form actions).
- Security over Convenience: Prefer secure defaults even when it adds implementation effort.

## 2. Architecture and Isolation

- Server-Only Isolation:
  - Keep Drizzle, D1 bindings, secrets, and auth internals in server files only.
  - Never import DB clients/bindings/secrets into `.svelte`, `+page.ts`, client stores, or browser-only modules.
- Environment Variables:
  - Use private env vars for secrets and privileged tokens.
  - Use `VITE_` only for truly public values.
  - Prevent accidental exposure of private bindings in client bundles.

## 3. Database Security (Manual RLS)

- No Client DB Access:
  - D1 bindings (`env.DB`) and Drizzle initialization must remain server-only.
- Manual RLS Enforcement:
  - D1 has no built-in RLS. Enforce access constraints in every query path.
  - Always enforce tenant boundary (`client_id`) and, where applicable, ownership boundary (`user_id`) and/or role boundary.
  - Never rely on broad `getAll()` for tenant data flows unless data is explicitly global/public.
- Trust Boundaries:
  - Never trust client-supplied `clientId`, `userId`, actor IDs, or roles for authorization.
  - Derive identity and tenant from trusted server context (`locals`) only.
- SQL Injection Prevention:
  - Always use Drizzle query builder or parameterized statements.
  - Never build SQL with raw user-controlled string concatenation.

## 4. Authentication and Authorization

- Server-Side Verification:
  - Validate sessions and permissions in server hooks/routes before privileged operations.
  - Never make security decisions from client-side state alone.
- Gatekeeping:
  - Protected resources must enforce `locals.user` and return `401`/`403` as appropriate.
- RBAC/ABAC:
  - Check role/subscription/ownership server-side before data access or mutation.
- Session Controls:
  - Use opaque random session tokens in cookies and store only token hashes server-side.
  - Session cookies must be `HttpOnly`, `Secure` (outside local dev), `SameSite=Lax`, and path-scoped to `/`.
  - Enforce expiration and server-side revocation checks on every request.
  - Sliding session renewal must happen server-side only and update expiry metadata atomically.
- Account Enumeration Resistance:
  - Login and registration must return generic, non-enumerating auth errors (do not reveal whether email, invite key, or account state exists).
  - Keep failure-path timing as uniform as practical (e.g., dummy password verification when user is missing) to reduce timing side channels.
- Least-Privilege Provisioning:
  - Self-registration must never create `admin` users by default.
  - Grant the minimum role required (for example `manager` or lower), with privileged elevation handled by a separate admin-only flow.
- API Route Policy:
  - Only auth bootstrap endpoints may be public (`/api/auth/login`, `/api/auth/register`).
  - All other protected APIs must require authenticated session context from `locals`.
  - Management APIs and dashboard routes require RBAC (`admin`/`manager` unless route-specific policy says otherwise).
- Tenant Context:
  - Tenant and actor identity must come from authenticated server session (`locals.user.clientId`, `locals.user.id`).
  - Never authorize or scope writes from client-submitted identity fields.

## 5. Input Validation and Abuse Controls

- Validation:
  - Validate all query params, path params, JSON bodies, and form payloads server-side using Zod.
  - Reject malformed input with stable error responses.
- CSRF Protection:
  - For cookie-authenticated mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`), enforce strict same-origin checks in hooks/server guards.
- Business Logic:
  - Perform critical calculations on the server. Do not trust client-computed values.
- Rate Limiting:
  - Apply rate limits to public endpoints and mutation paths to reduce abuse risk.

## 6. Operational Security

- Secure Headers:
  - Enforce strict headers (CSP, HSTS in production, `X-Content-Type-Options`, `Referrer-Policy`, clickjacking protection).
  - CSP must be compatible with required inline bootstrap behavior and should use nonce/hash-based policy where possible.
- Service Worker Caching:
  - Cache only immutable/static assets.
  - Never cache dynamic SSR HTML, `__data.json`, or API responses containing tenant/user data.
- Sensitive Response Caching:
  - Set `Cache-Control: no-store` on all auth responses and any API/SSR response containing session, user, tenant, or authorization-dependent data.
  - Default API responses to `no-store` unless a route is explicitly reviewed and approved for caching.
- Error Handling:
  - Never return raw exception messages, stack traces, DB internals, or file paths to clients.
  - Return generic client-facing errors and log internal details server-side.
- Logging:
  - Never log secrets, tokens, passwords, full auth payloads, or unnecessary PII.
- Dependencies:
  - Keep dependencies updated and monitor advisories.

## 7. Secret Management

- Exposed Credentials:
  - Any exposed credential (API token, key, secret) must be treated as compromised and rotated immediately.
  - If rotation is deferred by product decision, mark it as accepted critical risk and track remediation.

## 8. Enforcement Checklist (For AI Generation)

When generating or reviewing code, verify:

1. Server-only placement for sensitive logic and DB access.
2. Zod validation on all server inputs.
3. Authentication/authorization checks where required.
4. Tenant and ownership scoping in every sensitive query path.
5. No trust in client-supplied identity or tenant context.
6. No raw internal error leakage to clients.
7. Appropriate rate limiting and security headers.
8. Safe caching policy (no dynamic sensitive payload caching).
9. Opaque hashed session tokens with secure cookie settings and revocation support.
10. CSRF origin enforcement on mutating cookie-authenticated routes.
11. RBAC + tenant boundary enforcement derived from `locals`, never client identity fields.
12. Non-enumerating auth failures (content + timing) for login/register/password reset flows.
13. Least-privilege default role for all self-service account creation paths.
14. `Cache-Control: no-store` for all sensitive API/auth responses.
