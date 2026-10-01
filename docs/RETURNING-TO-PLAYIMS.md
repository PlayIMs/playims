# Returning to PlayIMs

Reviewed October 1, 2026 against local branch `codex/settings-ui-enhance`, starting at
`91506b9` (May 7, 2026). This is a source review, not confirmation of the deployed app.

## Where you left off

The latest work was dashboard refinement after substantial feature work:

| Date                           | Work recorded in Git                                         | What it means                                                        |
| ------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| May 7                          | Settings search palette matched the dashboard header         | Your latest local change focused on shared UI consistency.           |
| May 5                          | Dependency upgrades and auth/tenant hardening                | Authentication and organization boundaries are established concerns. |
| April 24–25                    | Schedule event wizard, schedule controls, date picker polish | Scheduling was a recent major work area.                             |
| April 17–24                    | Recipient selection, phone editing, communications layout    | Communications and member management were being refined together.    |
| April 16–17 and nearby commits | Facilities workspace, dashboard season/activity layout       | Core administrator workspaces received substantial attention.        |

The working tree was clean at the beginning of this review. Git records changes, not your
unwritten intentions: there is no reliable evidence that one particular task was your intended
next task. `docs/kanban.md` is dated January 30 and should be treated as historical planning.

## Product and code philosophy

Make everyday league administration fast and understandable while retaining detailed control.
Finish useful workflows in small, reviewable changes. Consistency comes from shared components,
not from independently styling every page.

Technically, this is SvelteKit with Svelte 5 runes, TypeScript, Tailwind 4, Zod validation,
Drizzle database operations, and Cloudflare D1/Pages. A typical feature flows through:

1. A Svelte page or shared component collects input.
2. A server load or API endpoint authenticates, authorizes, and validates the request.
3. Database operations read or mutate organization-scoped records.
4. The UI updates and provides inline field errors or shared toast feedback.

In plain English: the screen asks for something, the server checks whether it is allowed,
the database stores it, and the screen explains the result. Keep those responsibilities distinct.

## The files to remember

| Location                                     | Responsibility                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `AGENTS.md`                                  | Project rules, testing tiers, and learning-focused explanations               |
| `src/app.css` and `src/lib/theme.ts`         | Shared visual primitives and theme colors                                     |
| `src/lib/components/`                        | Reusable tables, dropdowns, search, helpers, editors, and modals              |
| `src/routes/dashboard/offerings/`            | Canonical module layout and creation interactions                             |
| `src/routes/dashboard/<module>/_wizards/`    | Feature-specific wrappers around shared wizards                               |
| `src/hooks.server.ts`                        | Session resolution, route policies, and request security                      |
| `src/lib/server/database/context.ts`         | Central versus organization database access                                   |
| `src/lib/database/schema/` and `operations/` | Stored data structure and database behavior                                   |
| `tests/`                                     | Server routes, validation, permissions, and shared behavior regression checks |
| `plugins/playims/`                           | Version-controlled source for your PlayIMs instruction plugin                 |

An ORM (Drizzle here) lets TypeScript code work with database tables. A migration is a recorded
database structure change. Generate migrations rather than editing generated migration files.

## Important refreshed facts

- Authentication is implemented. Organization roles come from `user_clients`; sessions hold
  the active organization and view mode. Protected routes must require authenticated client
  context, rather than silently using the default test organization.
- Use `getCentralDbOps` for identity, sessions, and memberships; use `getTenantDbOps` for
  organization domain data. A tenant means an organization whose data/access must stay scoped.
  Tenant routing supports shared storage and explicit D1 bindings; verify actual route records
  before assuming an organization has its own physical database.
- `wrangler.toml` locally points production at `playims-central-db-prod`. That does not prove
  the deployed binding or data cutover was verified.
- Communications defaults to a history-only provider unless Resend mode, API key, and sender
  are configured. A recorded message alone does not establish actual email delivery.
- Schedule event creation and a results-entry wizard exist. Do not equate their presence with
  complete conflict detection, standings automation, or tournament coverage without checking.

## How to work productively again

1. Start with one concrete user outcome, such as creating an event and entering its result.
2. Identify the actual route and existing shared component before changing anything. Similar
   routes can contain separate implementations; test the one the screen actually uses.
3. Choose the testing tier before editing. Styling/copy can use relaxed verification. Changes
   to state, filtering, validation, permissions, or mutations require a failing test first.
4. Complete the smallest coherent change, then verify the affected behavior. Full TDD work
   finishes with the full tests and type check, or `pnpm verify`.
5. Keep a short note of what worked, what remains, and the next concrete outcome.

Useful commands:

```powershell
pnpm test -- tests/schedule
pnpm check
pnpm verify
pnpm dev
```

`pnpm verify` runs lint, tests, and Svelte/TypeScript checking; it does not run a production
build or prove browser interactions. `pnpm catch-up` also fetches Git refs, can fast-forward
the checkout, installs dependencies, and applies local migrations: it is an environment repair
workflow, not just a read-only summary.

Suggested next session: verify one complete scheduling flow in the browser and through its
API/tests, then choose the first observed gap. This follows your recent work without claiming
an old backlog item is still unfinished.

## Plugin refresh

The repo-local plugin source is now version 0.2.0. It retains all ten specialized skills and
their existing product rules. Source inventories are now selective lookup maps, testing follows
`AGENTS.md`, and the broad style entrypoint routes to detailed recipes only when needed.

In plain English: give the model the relevant house rules and examples for the current job,
instead of making it reread the whole toolbox. These changes are model-independent; they have
not been benchmarked as a measured GPT-6.1 performance improvement.

The installed plugin uses a cached copy. Source changes in this repository do not establish
that the installed copy has refreshed. Reload/reinstall from the verified marketplace source
using the host's supported workflow; do not edit the cache directly. A separately installed
standalone wizard skill also appears in this session, so check for duplication before removing
anything. No other custom plugins were changed in this review.
