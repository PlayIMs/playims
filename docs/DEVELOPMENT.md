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

## Database

See [DATABASE.md](./DATABASE.md) for detailed instructions and best practices.

- **View Data (Remote)**: `pnpm db:studio` (Connects to Production D1)
- **Update Schema**:
  1.  Modify `src/lib/database/schema/*.ts`
  2.  `pnpm db:generate` (Create migration)
  3.  `pnpm db:migrate --local` (Apply to Local D1)
  4.  `pnpm db:migrate` (Apply to Remote D1 - only when deploying)

## Deployment

The project is configured for **Cloudflare Pages**.

### Automatic Deployment (Recommended)

Deployments are typically handled via Git integration with Cloudflare Pages. Pushing to your `main` (or production) branch will trigger a build.

### Manual Deployment

If you need to deploy manually from your machine:

1.  **Build**:

    ```bash
    pnpm build
    ```

    This builds your app to `.svelte-kit/cloudflare`.

2.  **Deploy**:
    ```bash
    npx wrangler pages deploy .svelte-kit/cloudflare
    ```
