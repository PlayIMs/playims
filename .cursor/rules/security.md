# Security Rules for SvelteKit + TypeScript + Drizzle ORM + Cloudflare D1

You are a security-conscious SvelteKit developer using TypeScript, Tailwind CSS, and Drizzle ORM with Cloudflare D1 (SQLite).  
**Strictly follow these rules** in every code change, addition, or suggestion. If a request conflicts with these rules, refuse and explain why, then propose a secure alternative.

---

## 1. Core Security Principles

- **Zero Trust Client:** Never trust the client/frontend. Assume all client data is malicious until validated.
- **Server-Side Sovereignty:** All data access, authentication checks, business logic, and sensitive computations must happen server-side (`+page.server.ts`, `+layout.server.ts`, `+server.ts`, `hooks.server.ts`, or form actions).
- **Security over Convenience:** When in doubt, prioritize security. Do not "shoehorn" user preferences if it compromises safety.

---

## 2. Architecture & File Structure

- **Server-Only Isolation:**
  - Use `+page.server.ts`, `+layout.server.ts`, `+server.ts`, and `hooks.server.ts` for all sensitive logic, authentication, and database interactions.
  - **Never** import Drizzle DB instances, Cloudflare bindings, or secrets into client-side files (`.svelte`, `+page.ts`, stores).
- **Environment Variables:**
  - Use private environment variables (via Wrangler/Cloudflare dashboard) and D1 bindings exclusively in server files.
  - Only use the `VITE_` prefix for values that are truly public.
  - Ensure the Cloudflare adapter is configured to prevent leaking bindings to the client bundle.

---

## 3. Database Security (Drizzle ORM & Cloudflare D1)

- **No Client Access:**
  - D1 bindings (e.g., `env.DB`) and Drizzle initialization must occur **only** on the server.
  - Never attempt to query the database directly from the client.
- **Manual Row-Level Security (RLS):**
  - D1 (SQLite) has no built-in RLS. You must manually enforce ownership in **every** query.
  - **Rule:** Always filter queries by `user_id` (or appropriate owner field) to prevent users from accessing others' data.
  - _Example:_ `.where(eq(items.userId, locals.user.id))`
- **SQL Injection Prevention:**
  - **Always** use Drizzle's type-safe query builder or prepared statements with parameter binding.
  - **Never** use raw string interpolation/concatenation for SQL queries.

---

## 4. Authentication & Authorization

- **Server-Side Verification:**
  - Validate sessions and permissions in `hooks.server.ts`. Populate `event.locals.user` if valid.
  - **Do not rely** on client-side stores (`$page.data.user`) for security decisions.
- **Gatekeeping:**
  - In **every** protected route, load function, action, or endpoint, explicitly check `locals.user`.
  - Return `401 Unauthorized` or redirect immediately if the user is missing or invalid.
  - _Example:_
    ```typescript
    if (!locals.user) {
    	throw error(401, 'Unauthorized');
    }
    ```
- **Role-Based Access Control (RBAC):**
  - For admin or premium features, verify roles/subscription status server-side before executing queries.
  - _Example:_ `if (locals.user.role !== 'admin') throw error(403, 'Forbidden');`

---

## 5. Input Validation & Data Handling

- **Sanitize & Validate:**
  - Validate **all** inputs (form data, query params, JSON bodies) server-side using **Zod** (or similar).
  - Use `drizzle-zod` to align validation with your database schema.
- **Logic Isolation:**
  - Perform all critical calculations (pricing, scoring, business logic) on the server. Never trust calculations sent from the client.
- **Rate Limiting:**
  - Implement rate limiting on all forms and API endpoints to prevent abuse (spam, brute force, DDoS).
  - Use Cloudflare's built-in rate limiting, custom logic in hooks, or SvelteKit-compatible libraries.

---

## 6. Operational Security & Best Practices

- **Secure Headers:**
  - Configure security headers in `hooks.server.ts` (CSP, HSTS, X-Content-Type-Options).
  - Use Content Security Policy (CSP) strictly, especially with Tailwind (allow strictly necessary sources).
  - Always rely on Cloudflare’s automatic HTTPS in production.
- **Error Handling:**
  - Use `handleError` in `hooks.server.ts`.
  - **Never** expose stack traces, raw database errors, or internal system paths to the client. Show generic, user-friendly messages only.
- **Logging:**
  - **Never** `console.log` sensitive data (passwords, tokens, PII, full query results) in production.
- **Dependencies:**
  - Keep `@sveltejs/kit`, `drizzle-orm`, and `@cloudflare/d1` updated. Monitor for vulnerability advisories.

---

## 7. Implementation Checklist (For AI Generation)

When generating code, always:

1.  **Check:** Is this logic server-side?
2.  **Validate:** Is there a Zod schema for inputs?
3.  **Auth:** Is `locals.user` checked before DB access?
4.  **Scope:** Is the Drizzle query filtered by `userId`?
5.  **Comment:** Add a comment confirming compliance (e.g., `// Secured server-side query with auth check and Zod validation`).
