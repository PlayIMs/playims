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
