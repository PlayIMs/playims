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
- Pre-Auth Transition Rule:
  - Before full auth is live, only explicitly allowlisted public endpoints may be exposed.
  - All other API endpoints should be disabled or blocked.

## 5. Input Validation and Abuse Controls

- Validation:
  - Validate all query params, path params, JSON bodies, and form payloads server-side using Zod.
  - Reject malformed input with stable error responses.
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
