# PlayIMs

The ultimate platform for managing intramural sports leagues. Built with SvelteKit and powered by Cloudflare D1 database.

## Features

- **Team Management**: Easy team registration, player rosters, and captain management tools
- **Smart Scheduling**: Automated game scheduling with conflict resolution and venue management
- **Live Standings**: Real-time standings, statistics, and league performance tracking
- **Database Integration**: Cloudflare D1 database for reliable data storage and management

## Tech Stack

- **Frontend**: SvelteKit with TailwindCSS
- **Database**: Cloudflare D1
- **Deployment**: Vercel
- **Package Manager**: pnpm

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.
