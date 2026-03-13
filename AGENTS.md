# PlayIMs - AI Coding Agent Guide

## Project Overview

PlayIMs is an intramural sports league management platform. It allows organizations to manage teams, leagues, divisions, scheduling, standings, and tournaments through a web-based interface.

**Live Application**: Cloudflare Pages deployment
**Domain**: Intramural sports league management
**Primary Language**: English (US)

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 2.x (Svelte 5 Runes) |
| Language | TypeScript 5.x |
| Styling | TailwindCSS 4.x |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM 0.45.x |
| Deployment | Cloudflare Pages |
| Package Manager | pnpm 10.x |
| Icons | @tabler/icons-svelte |
| Validation | Zod 4.x |

## Project Structure

```
src/
├── app.html              # HTML template with theme initialization script
├── app.css               # Global styles, Tailwind imports, component classes
├── app.d.ts              # TypeScript declarations (App.Locals, Platform)
├── hooks.server.ts       # Server hooks (minimal - DevTools handling)
├── lib/
│   ├── actions.ts        # Svelte actions (selectArrow)
│   ├── theme.ts          # Dynamic theming system
│   ├── database/         # Database layer
│   │   ├── drizzle.ts    # Drizzle client factory
│   │   ├── index.ts      # Main exports (DatabaseOperations, types)
│   │   ├── schema/       # Table definitions (one file per table)
│   │   ├── operations/   # Business logic classes
│   │   ├── migrations/   # SQL migration files
│   │   └── seed.sql      # Seed data
│   └── server/
│       └── client-context.ts  # Default client resolution
├── routes/               # SvelteKit file-based routing
│   ├── api/              # REST API endpoints
│   └── dashboard/        # Dashboard pages
static/                   # Static assets, PWA icons
```

## Build and Development Commands

```bash
# Development server (with HMR)
pnpm dev

# Full server-side Vitest suite
pnpm test

# Watch mode for local TDD loops
pnpm test:watch

# Full verification gate
pnpm verify

# Production build
pnpm build

# Preview production build locally
pnpm preview

# Dependency updates (interactive)
pnpm updates

# PWA asset generation
pnpm pwa-assets
```

## Database Commands

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations to local database
pnpm db:migrate:local

# Apply migrations to remote Cloudflare D1
pnpm db:migrate:remote

# Open Drizzle Studio (connects to remote DB)
pnpm db:studio

# Push schema directly (DANGER: bypasses migrations)
pnpm db:push

# Seed local database
pnpm db:seed:local

# Introspect existing database
pnpm db:introspect
```

## Code Style Guidelines

### Formatting (Prettier)
- **Indentation**: Tabs (not spaces)
- **Quotes**: Single quotes
- **Trailing commas**: None
- **Print width**: 100 characters
- **Svelte parser**: Used for `.svelte` files

### Linting (ESLint)
- Uses `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`
- Prettier compatibility enabled
- Browser and Node globals available
- Type-aware linting for Svelte files

### Naming Conventions
- **Files**: kebab-case (e.g., `client-context.ts`)
- **Components**: PascalCase Svelte files
- **Database tables**: snake_case in SQL, camelCase in TypeScript
- **Operations classes**: `XxxOperations` (e.g., `ClientOperations`)

## Commit Message Convention

Use commit messages with a prefix and brief description:

```text
<type>: <brief description>
```

Preferred types:
- `feat:` new feature or capability
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` structural cleanup without behavior change
- `style:` formatting/styling changes without logic changes
- `test:` test additions/updates
- `chore:` maintenance/tooling/config updates
- `perf:` performance improvements
- `build:` build/dependency pipeline changes
- `ci:` CI workflow changes

Examples:
- `feat: add optional footer action to ListboxDropdown`
- `fix: prevent listbox overflow on narrow viewports`
- `docs: add commit message guide`

See `docs/COMMIT_GUIDE.md` for the full standard.

## Database Architecture

### Schema Files Location
`src/lib/database/schema/*.ts` - One file per table

### Adding a New Table

1. Create `src/lib/database/schema/mytable.ts`:
```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable('my_table', {
    id: text().primaryKey(),
    name: text(),
    createdAt: text('created_at').default('sql`(CURRENT_TIMESTAMP)`')
});

export type MyTable = typeof myTable.$inferSelect;
export type NewMyTable = typeof myTable.$inferInsert;
```

2. Export in `src/lib/database/schema/index.ts`:
```typescript
export * from './mytable.js';
```

3. Generate migration:
```bash
pnpm db:generate
```

4. Create operations class in `src/lib/database/operations/mytable.ts`:
```typescript
import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { myTable, type MyTable } from '../schema/index.js';

export class MyTableOperations {
    constructor(private db: DrizzleClient) {}
    
    async getAll() {
        return await this.db.select().from(myTable);
    }
}
```

5. Register in `src/lib/database/operations/index.ts`:
```typescript
import { MyTableOperations } from './mytable.js';
// Add to DatabaseOperations class
public myTable: MyTableOperations;
this.myTable = new MyTableOperations(drizzleDb);
```

### Important Database Rules

- **NEVER** modify migration files manually after generation
- **ALWAYS** answer "Yes" when Drizzle Kit asks about column renames
- Use `onDelete: 'cascade'` in foreign keys for automatic cleanup
- Local and remote databases are **completely separate** - data does not sync

## API Patterns

### Server Load Function
```typescript
import { DatabaseOperations } from '$lib/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
    const dbOps = new DatabaseOperations(platform);
    const clients = await dbOps.clients.getAll();
    return { clients };
};
```

### API Endpoint
```typescript
import { DatabaseOperations } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
    const dbOps = new DatabaseOperations(platform);
    const data = await dbOps.clients.getAll();
    return json({ success: true, data });
};
```

## Theming System

PlayIMs uses a dynamic theming system with 4 customizable colors:

- **Primary**: Main brand color (default: `#CE1126`)
- **Secondary**: Background/contrast (default: `#14213D`)
- **Neutral**: Background tints (default: `#EEDBCE`, uses Zinc if empty)
- **Accent**: Highlight color (default: `#04669A`)

Each color generates a full 25-950 palette automatically.

### Theme Storage
- Current theme: `localStorage['current-theme']`
- Saved themes: `localStorage['saved-themes']` (max 10)

### CSS Variables
Colors are applied as CSS custom properties:
```css
--color-primary-500, --color-secondary-200, etc.
```

### Component Classes
Form controls use theme-aware classes:
- `input-primary`, `input-secondary`, `input-accent`
- `select-primary`, `select-secondary`, `select-accent`
- `checkbox-primary`, `checkbox-secondary`, `checkbox-accent`
- `radio-primary`, `radio-secondary`, `radio-accent`
- `toggle-primary`, `toggle-secondary`, `toggle-accent`
- `textarea-primary`, `textarea-secondary`, `textarea-accent`

## Authentication Context

Currently uses a **default client** approach until full auth is implemented:

```typescript
import { DEFAULT_CLIENT, resolveClientId } from '$lib/server/client-context.js';

// In server load:
const clientId = resolveClientId(locals);
```

Default Client ID: `6eb657af-4ab8-4a13-980a-add993f78d65`

## Environment & Deployment

### Local Development Requirements
- Node.js v24+ (or v20+ minimum)
- pnpm 10.x
- Wrangler CLI (authenticated with Cloudflare)

### D1 Database Bindings
Development (`wrangler.toml`):
- Database: `playims-central-db-dev`
- ID: `66dc8c86-b1da-4882-b259-f7847ecf5350`

Production:
- Database: `playims-central-db-prod`
- ID: `b20ff0a2-3fac-4645-a45a-bd7de64ec2a3`

### Cloudflare Pages Build Settings
- **Build command**: `pnpm build`
- **Build output**: `.svelte-kit/cloudflare`
- **Root directory**: `/`

### Environment Variables for Drizzle Studio
`drizzle.config.ts` requires these environment variables:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

## Testing Strategy

PlayIMs uses a server-first test workflow built around Vitest plus `svelte-check`.

Primary commands:

1. **Focused TDD loop**: `pnpm test -- <path-or-pattern>` or targeted scripts such as `pnpm test:auth`
2. **Full regression suite**: `pnpm test`
3. **Type checking**: `pnpm check`
4. **Final local gate**: `pnpm verify`
5. **Manual UI verification**: `pnpm dev`

Current suite scope:

- Route and server regression tests under `tests/**/*.test.ts`
- Auth and member flows already covered
- Server-first backfill in progress for themes, facilities, and intramural APIs

## UI Debugging Discipline

When a UI bug reproduces but parser or unit tests pass:

1. Confirm the exact active route and entry point from the screenshot, modal title, or surrounding page context before changing code.
2. Search sibling routes for duplicated wizard or inference logic before assuming a shared utility is the live source of truth.
3. Add or use one integration-path check that proves the rendered UI is wired to the same logic the tests cover.

## Agentic TDD Workflow

This repo is the source of truth for when Codex must use TDD and when it should stay fast.

### Step 1: Pick A Testing Tier First

Every task must start by choosing one of these tiers before editing code:

1. **Full TDD**
   Use this for:
   - `src/routes/api/**`
   - `src/hooks.server.ts`
   - `src/lib/server/**`
   - `src/lib/database/operations/**`
   - auth, validation, permissions, business rules, mutations, and bug fixes with behavior changes
2. **Relaxed**
   Use this for:
   - pure styling, spacing, typography, icons, copy edits
   - static markup reshaping
   - trivial prop plumbing with no new logic
3. **Escalate To Full TDD**
   Any UI task that adds conditions, state transitions, validation, filtering, permissions, or non-trivial data shaping must move back to **Full TDD**.

### Full TDD Loop (mandatory)

1. Check whether relevant tests already exist.
2. If touching older untested logic, write characterization tests first to lock current behavior.
3. Write the new failing test before implementation.
4. Run the narrowest relevant test command first.
5. Implement the minimum code needed to go green.
6. Re-run the targeted tests until green.
7. Finish with `pnpm test` and `pnpm check` or `pnpm verify` when the task is complete.

### Relaxed Loop (for trivial work only)

1. Implement directly.
2. Manually verify the changed page, component, or flow.
3. Add 0-2 regression tests only if the change could plausibly break later.
4. Run the lightest sensible validation command before finishing.

### Guardrails

- Do not default to snapshot-heavy or DOM-heavy tests for trivial UI work.
- Prefer route tests, validation tests, and helper tests over brittle implementation-detail assertions.
- For legacy areas without tests, protect current behavior before changing it.
- `pnpm verify` is the repo-level local gate until CI is added.
- treat the test comment standard as a mandatory completion step whenever creating or updating a test file.
- every new or updated test file must include instructional comments for learning-focused developers.
- each test file must start with one top-of-file block comment that uses this exact structure:
  - `Brief description:`
  - `Deeper explanation:`
  - `Summary of tests:`
- the full header block must use proper grammar and sentence case.
- all non-header code comments in tests must stay lowercase only.
- helper functions, setup blocks, and non-obvious assertions in tests must explain the "why", not just the "what".
- if a test changes later, its explanatory comments must be updated so they stay accurate.
- a test file is not complete until its header block and lowercase teaching comments are in place and accurate.

## Common Issues

### Chrome DevTools Warning
A server hook handles Chrome DevTools project settings requests to prevent 404 errors in development.

### Tabler Icons SSR
Icons are explicitly included in `optimizeDeps` and marked `noExternal` for SSR compatibility.

### Theme Flash Prevention
`app.html` includes a blocking script that applies the theme before first paint to prevent FOUC (flash of unstyled content).

## Security Considerations

1. **Database**: Uses parameterized queries via Drizzle ORM (SQL injection safe)
2. **Validation**: Zod schemas should be used for all user input
3. **Auth**: Currently minimal - proper authentication to be implemented
4. **CORS**: Handled by Cloudflare Pages/Workers platform

## External Dependencies

### Google Fonts
- Inter (sans-serif) - UI elements
- Bitter (serif) - Headings

Loaded from `fonts.googleapis.com` in `app.html`.

### CDN Resources
None currently (self-hosted PWA assets)

## File Generation Notes

Some files are auto-generated and should not be manually edited:
- `.svelte-kit/` - SvelteKit build output
- `src/lib/database/migrations/*.sql` - Drizzle Kit generated
- `src/lib/database/migrations/meta/` - Migration metadata
- `static/pwa-*.png`, `static/maskable-icon-*.png` - PWA asset generator
