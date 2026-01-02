# Development Guide

## Prerequisites

- **Node.js**: v20 or higher.
- **pnpm**: Package manager.
- **Wrangler**: Cloudflare CLI (`npm install -g wrangler`).

## Getting Started

1.  **Install Dependencies**:

    ```bash
    pnpm install
    ```

2.  **Start Development Server**:
    To develop with the local D1 database, use the Wrangler binding:
    ```bash
    pnpm dev
    ```
    _Note: This runs `vite dev`. To test with Cloudflare platform features closer to production, use `pnpm build && wrangler pages dev .svelte-kit/cloudflare`._

## Database Management

We use Drizzle ORM with Cloudflare D1. We have two environments:

- **Dev**: `playims-central-db-dev` (default for local work)
- **Prod**: `playims-central-db-prod` (live site)

See [DATABASE.md](./DATABASE.md) for schema details.

### Schema Change Workflows

To avoid downtime and application crashes, we follow strict workflows for schema changes.

#### 1. Additive Changes (Safe)

_Examples: Adding a new table, adding a nullable column, adding a column with a default value._

**Workflow:** Migrate DB -> Deploy Code.
This ensures the database has the new elements before the new code tries to access them. Old code simply ignores the new fields.

1.  **Modify Schema**: Update `src/lib/database/schema/*.ts`.
2.  **Generate Migration**:
    ```bash
    pnpm db:generate
    ```
3.  **Test Locally (Dev)**:
    ```bash
    pnpm db:migrate:dev:local
    ```
4.  **Test Remote Dev (Optional)**:
    If you want to verify against the real Dev D1 database:
    ```bash
    pnpm db:migrate:dev:remote
    ```
5.  **Commit & Push**:
    ```bash
    git add .
    git commit -m "feat: add users table"
    git push
    ```
    _GitHub Actions will automatically apply migrations to the **Production** database (`playims-central-db-prod`) before deploying the new code._

#### 2. Destructive Changes (Breaking)

_Examples: Dropping a table, removing a column, renaming a column._

**Workflow:** Deploy Code -> Migrate DB.
The code must stop using the field _before_ it is removed from the database.

1.  **Update Code**: Remove all references to the column/table in your application code.
2.  **Modify Schema**: Remove the column/table from `src/lib/database/schema/*.ts`.
3.  **Generate Migration**:
    ```bash
    pnpm db:generate
    ```
4.  **Test Locally**:
    ```bash
    pnpm db:migrate:dev:local
    ```
5.  **Commit & Push (Deploy Code First)**:
    _Important_: In GitHub Actions, you may need to manually skip the migration step if it's set to run automatically (by setting `apply_migrations` to `false` in the manual trigger), or rely on the workflow configuration.
    ```bash
    git add .
    git commit -m "refactor: remove legacy column"
    git push
    ```
6.  **Apply to Remote (After Deploy)**:
    Once the deployment is complete and confirmed stable, manually apply the migration to production:
    ```bash
    pnpm db:migrate:prod
    ```

#### 3. Zero-Downtime "Expand-Contract" (Complex)

_Examples: Renaming a column while maintaining data, changing column type._

**Phase 1: Expand (Additive)**

1.  Add the new column (e.g., `new_email`).
2.  Deploy code that writes to **both** `old_email` and `new_email`, but reads from `old_email`.
3.  Backfill `new_email` from `old_email` (via script or migration).

**Phase 2: Migrate Reads**

1.  Deploy code that reads from `new_email`.

**Phase 3: Contract (Destructive)**

1.  Deploy code that stops writing to `old_email`.
2.  Drop `old_email` column in the database.

### Automation

We use GitHub Actions to automate migrations for additive changes.

- **On Push to Main**: The workflow attempts to apply migrations to `playims-central-db-prod` _before_ deploying.
- **Destructive Changes**: You can manually trigger the workflow with `apply_migrations: false` or let the code deploy first and run migrations manually later.

### Important Notes

- **Backups**: Always backup your production D1 database before running destructive migrations:
  ```bash
  npx wrangler d1 backup create playims-central-db-prod
  ```
- **Verification**: Check migration status:
  ```bash
  npx wrangler d1 migrations list playims-central-db-prod --remote
  ```
- **D1 Limitations**: D1 does not support runtime schema changes outside of the migrations system.

## Deployment

The project is configured for **Cloudflare Pages**.

### Automatic Deployment (Recommended)

Pushing to `main` triggers the GitHub Actions workflow defined in `.github/workflows/deploy.yml`, which handles:

1.  Installation
2.  Database Migrations (Remote)
3.  Pages Deployment

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
