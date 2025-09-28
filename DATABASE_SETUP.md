# D1 Database Setup Guide (Vercel Deployment)

This project uses Cloudflare D1 database with SvelteKit deployed on Vercel. The setup supports both local development (using wrangler) and production (using D1 REST API).

## Prerequisites

1. Cloudflare account
2. Vercel account
3. Wrangler CLI installed globally: `npm install -g wrangler`
4. Authenticated with Cloudflare: `wrangler auth login`

## Database Setup Steps

### 1. Your D1 Database (Already Done)

Your database `playims-central-db-dev` is already created with ID: `66dc8c86-b1da-4882-b259-f7847ecf5350`

### 2. Create Database Tables

Create your database schema by running SQL commands:

```bash
# Create clients table
wrangler d1 execute playims-central-db-dev --command="CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);"

# Create users table
wrangler d1 execute playims-central-db-dev --command="CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);"
```

### 3. Add Sample Data (Optional)

```bash
# Add sample clients
wrangler d1 execute playims-central-db-dev --command="INSERT INTO clients (name, email, created_at, updated_at) VALUES
  ('John Doe', 'john@example.com', datetime('now'), datetime('now')),
  ('Jane Smith', 'jane@example.com', datetime('now'), datetime('now'));"

# Add sample users
wrangler d1 execute playims-central-db-dev --command="INSERT INTO users (username, email, created_at, updated_at) VALUES
  ('johndoe', 'john.doe@example.com', datetime('now'), datetime('now')),
  ('janesmith', 'jane.smith@example.com', datetime('now'), datetime('now'));"
```

### 4. Environment Configuration

#### For Local Development:

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Update `.env` with your actual values:

```env
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id-here
CLOUDFLARE_DATABASE_ID=66dc8c86-b1da-4882-b259-f7847ecf5350
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token-here
```

#### For Vercel Deployment:

Add the same environment variables to your Vercel project:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables:
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
   - `CLOUDFLARE_DATABASE_ID`: `66dc8c86-b1da-4882-b259-f7847ecf5350`
   - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with D1 permissions

### 5. Get Your Cloudflare Credentials

#### Account ID:

1. Go to Cloudflare Dashboard
2. In the right sidebar, you'll see your Account ID

#### API Token:

1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Set permissions:
   - Account: Cloudflare D1:Edit
   - Zone Resources: Include All zones (or specific zones if needed)
5. Copy the generated token

## Development Environments

### Local Development (Two Options)

#### Option 1: Regular SvelteKit Dev (Production API)

```bash
# Uses D1 REST API (same as production)
npm run dev
```

#### Option 2: Wrangler Dev (Local D1)

```bash
# Build the project first
npm run build

# Run with local D1 database
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

### Production Deployment (Vercel)

Deploy to Vercel as usual:

```bash
# Deploy to Vercel
vercel --prod
```

The application will automatically use the D1 REST API in production.

## Architecture Overview

### Local Development with Wrangler:

- Uses direct D1 database connection via `platform.env.DB`
- Faster queries, real-time database access
- Requires `wrangler pages dev` command

### Production on Vercel:

- Uses Cloudflare D1 REST API
- HTTP requests to Cloudflare's API
- Works with standard Vercel deployment

### Regular Local Dev:

- Uses D1 REST API (same as production)
- Good for testing production-like behavior
- Works with standard `npm run dev`

## Using the Database Library

The same API works in all environments:

### In Server-Side Load Functions

```typescript
// src/routes/+page.server.ts
import { createDatabaseConnection } from '$lib/database';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = createDatabaseConnection(platform);

	const clients = await db.clients.getAll();
	const users = await db.users.getAll();

	return {
		clients,
		users
	};
};
```

### In API Routes

```typescript
// src/routes/api/clients/+server.ts
import { createDatabaseConnection } from '$lib/database';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const db = createDatabaseConnection(platform);
	const clients = await db.clients.getAll();
	return json(clients);
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const db = createDatabaseConnection(platform);
	const data = await request.json();
	const client = await db.clients.create(data);
	return json(client);
};
```

## Available Query Methods

### Clients

- `db.clients.getAll()` - Get all clients
- `db.clients.getById(id)` - Get client by ID
- `db.clients.create(data)` - Create new client
- `db.clients.update(id, data)` - Update client
- `db.clients.delete(id)` - Delete client

### Users

- `db.users.getAll()` - Get all users
- `db.users.getById(id)` - Get user by ID
- `db.users.create(data)` - Create new user
- `db.users.update(id, data)` - Update user
- `db.users.delete(id)` - Delete user

## Environment Detection

The system automatically detects the environment:

- **Local with Wrangler**: Uses direct D1 connection (`platform.env.DB`)
- **Production/Local Dev**: Uses D1 REST API

Check the browser console to see which environment is being used.

## Troubleshooting

1. **API Token Issues**: Ensure your Cloudflare API token has D1:Edit permissions
2. **Environment Variables**: Make sure all required env vars are set in both `.env` and Vercel
3. **Database ID**: Verify the database ID matches your actual D1 database
4. **CORS Issues**: D1 REST API should work from Vercel, but check for any network issues
5. **Local Development**: Use `wrangler pages dev` for local D1 access, or `npm run dev` for REST API testing

## Console Logging

The application logs database query results to the browser console on page load, showing:

- Environment type (local/production)
- Query results
- Error messages (if any)
- Total record counts

This helps you verify the database connection is working correctly in both environments.
