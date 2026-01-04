# PlayIMs

The ultimate platform for managing intramural sports leagues. Built with **SvelteKit** and powered by **Cloudflare D1** database.

## Documentation

- [Development Guide](docs/DEVELOPMENT.md): How to start the app and environment setup.
- [Database Guide](docs/DATABASE.md): Schema, migrations, and Drizzle ORM usage.

## Deployment Setup

This project uses **Cloudflare Pages** for automatic deployment. When you connect your GitHub repository to Cloudflare Pages, it will automatically build and deploy on every push to `main`.

### Cloudflare Pages Configuration

1.  **Connect Repository**:
    - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) > Pages
    - Click "Create a project" and connect your GitHub repository

2.  **Build Settings**:
    - **Build command**: `pnpm build`
    - **Build output directory**: `.svelte-kit/cloudflare`
    - **Root directory**: `/` (project root)

3.  **Environment Variables** (if needed):
    - Add any required environment variables in the Cloudflare Pages dashboard

Cloudflare Pages will automatically handle builds and deployments. Database migrations should be applied manually using `pnpm db:migrate:remote` when needed.

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
