# Development Guide

## Prerequisites

*   **Node.js**: v20 or higher.
*   **pnpm**: Package manager.
*   **Wrangler**: Cloudflare CLI (`npm install -g wrangler`).

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
    *Note: This runs `vite dev`. To test with Cloudflare platform features closer to production, use `pnpm build && wrangler pages dev .svelte-kit/cloudflare`.*

## Database

See [DATABASE.md](./DATABASE.md) for detailed instructions.

*   **View Data**: `pnpm db:studio`
*   **Update Schema**: Edit schema files, then run `pnpm db:generate` and `pnpm db:migrate`.

## Deployment

The project is configured for **Cloudflare Pages**.

1.  **Build**:
    ```bash
    pnpm build
    ```
    This output is located in `.svelte-kit/cloudflare`.

2.  **Deploy**:
    Deployments are typically handled via Git integration with Cloudflare Pages.
