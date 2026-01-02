# PlayIMs

The ultimate platform for managing intramural sports leagues. Built with **SvelteKit** and powered by **Cloudflare D1** database.

## Documentation

*   [Development Guide](docs/DEVELOPMENT.md): How to start the app and environment setup.
*   [Database Guide](docs/DATABASE.md): Schema, migrations, and Drizzle ORM usage.

## GitHub Automation Setup

To enable the automated deployment and migration workflow, you need to configure secrets in your GitHub repository.

1.  **Go to Secrets**:
    - Navigate to your GitHub repository.
    - Click **Settings** > **Secrets and variables** > **Actions**.

2.  **Add Repository Secrets**:
    Click **New repository secret** and add the following:

    *   `CLOUDFLARE_API_TOKEN`:
        - Create this in the [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens).
        - Template: **Edit Cloudflare Workers**.
        - Permissions: Ensure it has **Account.D1:Edit** and **Zone.Pages:Edit** (or Workers permissions).
    *   `CLOUDFLARE_ACCOUNT_ID`:
        - Found in the URL of your Cloudflare Dashboard or on the right sidebar of the Workers & Pages overview.
    *   `D1_DB_NAME`:
        - The name of your D1 database (e.g., `playims-central-db-dev`).
        - You can find this in `wrangler.toml` or run `npx wrangler d1 list`.

3.  **Verify**:
    - Push a change to `main` to trigger the workflow.
    - Monitor the "Actions" tab to ensure migrations are applied and the app deploys successfully.

## Features

- **Team Management**: Easy team registration, player rosters, and captain management tools
- **Smart Scheduling**: Automated game scheduling with conflict resolution and venue management
- **Live Standings**: Real-time standings, statistics, and league performance tracking
- **Database Integration**: Cloudflare D1 database for reliable data storage and management

## Tech Stack

- **Frontend**: SvelteKit with TailwindCSS
- **Database**: Cloudflare D1 (with Drizzle ORM)
- **Deployment**: Cloudflare Pages
- **Package Manager**: pnpm
