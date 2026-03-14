# Development Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v24.x.x (recommended), or at least `20.19.0` / `22.12.0` to satisfy Vite 8. You can check your version with `node --version`.
  - If you need to install or switch versions, consider using [nvm](https://github.com/nvm-sh/nvm) (Mac/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows) (Windows).
- **pnpm**: Package manager (v10.2.1 or compatible). Install it globally:
  ```bash
  npm install -g pnpm
  ```
- **Portless**: Named local domains for development. Install it globally:
  ```bash
  npm install -g portless
  ```
  Official Portless docs currently list support for **macOS and Linux only**. If you develop on
  native Windows, keep using `pnpm dev`. If you want Portless on a Windows machine, run the
  project inside **WSL2** and use `pnpm dev:portless` there.
- **Wrangler**: Cloudflare CLI. Install it globally:
  ```bash
  npm install -g wrangler
  ```
  After installation, authenticate with Cloudflare:
  ```bash
  wrangler login
  ```

## First-Time Setup

Follow these steps to set up the project for the first time:

### 1. Clone and Install Dependencies

```bash
# Clone the repository (if you haven't already)
git clone <repository-url>
cd playims

# Install all project dependencies
pnpm install
```

### 2. Set Up Local D1 Database

The local D1 database is automatically created when you first run migrations. This creates a SQLite file in the `.wrangler/` directory that simulates Cloudflare D1 for local development.

**Apply existing migrations to your local database:**

```bash
pnpm db:migrate:local
```

This command:

- Creates the local D1 database file (if it doesn't exist)
- Applies all migration files from `src/lib/database/migrations/` to set up your local database schema
- The database will be stored in `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` (this directory is automatically created)

**Verify the setup:**

You can verify your local database is set up correctly by checking that the `.wrangler/` directory exists after running the migration command.

### 3. (Optional) Seed Local Database

If you want to populate your local database with initial test data:

```bash
pnpm db:seed:local
```

This runs the seed SQL file (`src/lib/database/seed.sql`) against your local database.

### 4. Start Development Server

Now you're ready to start developing:

```bash
pnpm dev
```

This will:

- Start the Vite development server directly
- Open the normal local Vite URL in your browser
- Use your local D1 database (created in step 2)

If you are on macOS, Linux, or WSL2 and want the Portless hostname instead, first install Portless
globally and run this one-time HTTPS setup:

```bash
npm install -g portless
portless proxy start --https
```

Then start the app with:

```bash
pnpm dev:portless
```

That gives you:

- `http://playims.localhost:1355`, or
- `https://playims.localhost` after the HTTPS setup above

If you are on native Windows, do not use Portless directly. Use:

```bash
pnpm dev
```

_Note: `pnpm dev:portless` follows the official Portless SvelteKit/Vite setup. To test with
Cloudflare platform features closer to production, use
`pnpm build && wrangler pages dev .svelte-kit/cloudflare`._

## Getting Started (After Initial Setup)

Once you've completed the first-time setup, you can simply run:

```bash
pnpm dev
```

to start developing on the standard local Vite server. The local database will persist between
sessions, so you only need to run `pnpm db:migrate:local` again when new migrations are added to
the project.

If you are using a supported Portless environment such as macOS, Linux, or WSL2, run:

```bash
pnpm dev:portless
```

to use the `playims.localhost` hostname instead.

## Testing And Verification

PlayIMs uses a pragmatic, server-first TDD workflow.

Core commands:

```bash
# Run the full Vitest suite
pnpm test

# Stay in a local red -> green loop
pnpm test:watch

# Run type-checking
pnpm check

# Final local gate before wrapping up a task
pnpm verify
```

How to use them:

- Use **full TDD** for API routes, server helpers, database operations, validation, permissions, and other behavior-heavy changes.
- Use the **relaxed path** for trivial UI changes such as spacing, color, copy, icon swaps, and markup-only cleanup.
- If you touch older server code with no tests yet, add characterization tests first so current behavior is locked before you change it.

See [TESTING.md](./TESTING.md) for the full repo workflow and Codex-specific guidance.

## Commit Message Standard

Use commit prefixes like `feat:`, `fix:`, and `docs:` followed by a brief, specific description.

See `docs/COMMIT_GUIDE.md` for the full standard and examples.

## Database Management

We use Drizzle ORM with Cloudflare D1. Currently, we work exclusively with the **dev database** (`playims-central-db-dev`).

See [DATABASE.md](./DATABASE.md) for schema details.

### Schema Change Workflow

The standard workflow for making database changes:

1.  **Modify Schema**: Update `src/lib/database/schema/*.ts`.
2.  **Generate Migration**:
    ```bash
    pnpm db:generate
    ```
    This creates a SQL migration file in `src/lib/database/migrations/`.
3.  **Test Locally**:
    ```bash
    pnpm db:migrate:local
    ```
    This applies the migration to your local development database (used by `pnpm dev`).
4.  **Apply to Remote Dev Database**:
    ```bash
    pnpm db:migrate:remote
    ```
    This applies the migration to the remote dev database on Cloudflare.
5.  **Commit & Push**:
    ```bash
    git add .
    git commit -m "feat: add users table"
    git push
    ```

### Database Commands

- **`pnpm db:generate`**: Generate migration files from schema changes
- **`pnpm db:migrate:local`**: Apply migrations to local dev database
- **`pnpm db:migrate:remote`**: Apply migrations to remote dev database
- **`pnpm db:studio`**: Open Drizzle Studio to view/edit database
- **`pnpm db:push`**: Push schema directly (bypasses migrations - use with caution)
- **`pnpm db:seed:local`**: Seed local database with initial data

### Important Notes

- **Local vs Remote**: Your local database (used by `pnpm dev`) is separate from the remote dev database. Both use the same schema, but data is not synced.
- **Migration History**: Drizzle tracks applied migrations in the `__drizzle_migrations` table. Never modify migration files manually after they've been applied.
- **Future Production**: When ready for production, you'll switch the database configuration to use the production database. The workflow will remain the same.

## Deployment

The project is configured for **Cloudflare Pages**.

### Automatic Deployment

When your repository is connected to Cloudflare Pages, pushing to `main` will automatically:

1.  Build your application
2.  Deploy to Cloudflare Pages

Configure your build settings in the Cloudflare Dashboard:

- **Build command**: `pnpm build`
- **Build output directory**: `.svelte-kit/cloudflare`

_Note: Database migrations should be applied manually using `pnpm db:migrate:remote` before or after deployment, depending on whether the changes are additive or destructive._

### Manual Deployment

If you need to deploy manually from your machine:

1.  **Build**:
    ```bash
    pnpm build
    ```
2.  **Deploy**:
    ```bash
    npx wrangler pages deploy .svelte-kit/cloudflare
    ```

## Theme Boot And No-Flicker Contract (Critical)

The app has strict startup rules to prevent theme flicker (FOUC), especially on dashboard navigation
surfaces.

### Files Involved

- `src/app.html`
- `src/routes/+layout.server.ts`
- `src/routes/+layout.svelte`
- `src/lib/theme.ts`
- `src/routes/dashboard/+layout.svelte`

### Required Behavior

1. The `<body>` must remain hidden until theme startup is complete.
2. Theme CSS variables must exist before first visible paint.
3. `theme-ready` must be set only after:
   - theme variables are applied, and
   - pending stylesheet links are loaded, and
   - at least two paint frames have elapsed.
4. Dashboard sidebar base background must be explicit and not rely on `transition-all` during
   initial render.

### Current Implementation Rules

- `src/app.html`
  - Keeps `body { visibility: hidden; }`.
  - Reveals only with `body.theme-ready`.
  - Disables transitions/animations while `theme-ready` is absent.

- `src/routes/+layout.svelte`
  - Injects server-computed theme CSS variables in `<svelte:head>` (`#initial-theme-vars`).
  - Runs a blocking head script to set theme variables and `meta[name="theme-color"]`.
  - Does not reveal the body directly from head script.

- `src/lib/theme.ts`
  - `init(...)` is the single reveal path.
  - `markThemeReady()` waits for stylesheet readiness and two RAF ticks, then adds `theme-ready`.

- `src/routes/dashboard/+layout.svelte`
  - Sidebar uses explicit inline `background-color: var(--color-primary-500)`.
  - Avoids `transition-all` on sidebar container and nav rows during startup-sensitive render.

### Do Not Change (Without Re-Testing Flicker)

- Do not call `document.body.classList.add('theme-ready')` anywhere except `markThemeReady()` in
  `src/lib/theme.ts`.
- Do not remove the hidden-body gate in `src/app.html`.
- Do not move theme variable bootstrap out of root layout head.
- Do not reintroduce `transition-all` on the dashboard sidebar container/nav items.

### Regression Test Checklist

After any theme/layout/bootstrap change, verify:

1. Hard refresh `/dashboard` with cache disabled.
2. Hard refresh `/colors` with cache disabled.
3. Confirm no frame where sidebar/button backgrounds go transparent or default.
4. Confirm theme persists correctly across refresh and route navigation.

## Date Tooltip Contract

All visible dates and datetimes in the web app must provide a hover tooltip with full normalized formatting.

Implementation rule:

- Use `src/lib/components/DateHoverText.svelte` for displayed dates instead of raw text.
- Pass compact visible text as `display`, and pass raw source values via `value` (and `endValue` for ranges).
- Set `includeTime` when the displayed value includes time.

Tooltip format:

- Date-only: `Monday, January 01, 2026`
- Date-time: `Monday, January 01, 2026, 11:59PM EST`

Do not use native `title` attributes or ad-hoc tooltip implementations for date displays.
