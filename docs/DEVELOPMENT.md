# Development Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v24.x.x (recommended) or v20+ (minimum). You can check your version with `node --version`.
  - If you need to install or switch versions, consider using [nvm](https://github.com/nvm-sh/nvm) (Mac/Linux) or [nvm-windows](https://github.com/coreybutler/nvm-windows) (Windows).
- **pnpm**: Package manager (v10.2.1 or compatible). Install it globally:
  ```bash
  npm install -g pnpm
  ```
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

- Start the Vite development server
- Automatically open your browser to the local development URL
- Use your local D1 database (created in step 2)

_Note: This runs `vite dev`. To test with Cloudflare platform features closer to production, use `pnpm build && wrangler pages dev .svelte-kit/cloudflare`._

## Getting Started (After Initial Setup)

Once you've completed the first-time setup, you can simply run:

```bash
pnpm dev
```

to start developing. The local database will persist between sessions, so you only need to run `pnpm db:migrate:local` again when new migrations are added to the project.

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
