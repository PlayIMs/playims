# Hybrid Database System - Works Everywhere! 🌍

## Overview

Your application now has a **smart hybrid database system** that automatically works in both local development and production without any code changes!

---

## How It Works

The `DatabaseOperations` class automatically detects your environment and chooses the right connection method:

```typescript
import { DatabaseOperations } from '$lib/database';

// Same code works everywhere!
const dbOps = new DatabaseOperations(platform);
const clients = await dbOps.clients.getAll();
```

### Local Development (wrangler)

**Detects:** `platform.env.DB` exists  
**Uses:** Drizzle ORM with direct D1 binding  
**Benefits:** Fast queries, type-safe, Drizzle Studio access

### Production (Vercel)

**Detects:** `platform.env.DB` is undefined  
**Uses:** D1 REST API (HTTP requests to Cloudflare)  
**Benefits:** Works on Vercel, no D1 binding required

---

## Architecture

```
┌─────────────────────────────────────┐
│   Your Code (Same Everywhere!)     │
│                                     │
│   const dbOps = new Database        │
│   Operations(platform);             │
│   await dbOps.clients.getAll();    │
└──────────────┬──────────────────────┘
               │
               │ Auto-detects environment
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐  ┌────────────────┐
│   LOCAL      │  │  PRODUCTION    │
│  (wrangler)  │  │   (Vercel)     │
│              │  │                │
│  Drizzle ORM │  │  D1 REST API   │
│  ↓           │  │  ↓             │
│  Direct D1   │  │  HTTP to       │
│  Binding     │  │  Cloudflare    │
└──────────────┘  └────────────────┘
```

---

## File Structure

```
src/lib/database/
├── operations/              # Drizzle operations (local dev)
│   ├── index.ts            # Smart router (detects environment)
│   ├── clients.ts
│   ├── users.ts
│   └── ... (5 more tables)
│
├── rest-operations/         # REST API operations (production)
│   ├── index.ts            # REST operations wrapper
│   ├── clients.ts          # REST client operations
│   └── users.ts            # REST user operations
│
├── d1-client.ts            # D1 HTTP API client
├── drizzle.ts              # Drizzle client factory
└── schema.ts               # Shared schema & types
```

---

## Current Status

### ✅ Fully Implemented (Both Environments)

- **Clients** - Works locally (Drizzle) + production (REST)
- **Users** - Works locally (Drizzle) + production (REST)

### ⏳ Drizzle Only (Need REST Implementation)

- **Sports** - Works locally, needs REST for production
- **Leagues** - Works locally, needs REST for production
- **Divisions** - Works locally, needs REST for production
- **Teams** - Works locally, needs REST for production
- **Rosters** - Works locally, needs REST for production

**For these tables:** They work perfectly in local development. In production, you'll get a helpful error message telling you to implement REST operations.

---

## Usage (Zero Changes Needed!)

### In Any Route or API Endpoint

```typescript
import { DatabaseOperations } from '$lib/database';

export const load = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);

	// Works in both local and production!
	const clients = await dbOps.clients.getAll();
	const users = await dbOps.users.getAll();

	return { clients, users };
};
```

**You never think about the environment!** The system handles it automatically.

---

## Development Modes

### Regular Dev (Uses REST API)

```bash
pnpm run dev
```

- Runs on `http://localhost:5173`
- Uses D1 REST API (same as production)
- Fast hot reload

### Wrangler Dev (Uses Drizzle)

```bash
pnpm run build
wrangler pages dev .svelte-kit/cloudflare
```

- Runs on `http://127.0.0.1:8788`
- Uses Drizzle ORM with local D1 binding
- Access to Drizzle Studio

### Production (Uses REST API)

```bash
vercel --prod
```

- Deployed to Vercel
- Uses D1 REST API automatically
- No code changes needed!

---

## Adding REST Support for More Tables

When you need to use other tables in production, just create the REST operation file:

### Example: Adding Sports REST Operations

Create `src/lib/database/rest-operations/sports.ts`:

```typescript
import { D1RestClient } from '../d1-client.js';
import type { Sport } from '../schema.js';

export class SportRestOperations {
	constructor(private client: D1RestClient) {}

	async getAll(): Promise<Sport[]> {
		const result = await this.client.query('SELECT * FROM sports ORDER BY name ASC');
		return result.results || [];
	}

	async getById(id: string): Promise<Sport | null> {
		const result = await this.client.query('SELECT * FROM sports WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	// ... other methods
}
```

Then update `rest-operations/index.ts`:

```typescript
import { SportRestOperations } from './sports.js';

export class RestDatabaseOperations {
	public clients: ClientRestOperations;
	public users: UserRestOperations;
	public sports: SportRestOperations; // ← Add this

	constructor() {
		const client = new D1RestClient();

		this.clients = new ClientRestOperations(client);
		this.users = new UserRestOperations(client);
		this.sports = new SportRestOperations(client); // ← Add this
	}
}
```

And update `operations/index.ts`:

```typescript
// In constructor's else block:
this.sports = restOps.sports; // ← Change from createNotImplemented
```

---

## Benefits of Hybrid System

✅ **Works Everywhere** - Local and production with same code  
✅ **Auto-Detection** - No environment checks in your app code  
✅ **Type-Safe** - Drizzle provides types for both systems  
✅ **Fast Local Dev** - Drizzle with direct D1 access  
✅ **Vercel Compatible** - REST API for production  
✅ **Progressive** - Add REST operations as needed  
✅ **Zero Config** - Just works!

---

## Environment Detection

The system checks for `platform?.env?.DB`:

```typescript
if (platform?.env?.DB) {
	// D1 binding available → Use Drizzle ORM
	console.log('Using Drizzle ORM (local development)');
} else {
	// No D1 binding → Use REST API
	console.log('Using D1 REST API (production)');
}
```

---

## Testing Both Modes

### Test with REST API (Production Mode)

```bash
# Start regular dev server
pnpm run dev

# Visit: http://localhost:5173
# This uses REST API (same as production)
```

### Test with Drizzle (Local Mode)

```bash
# Build and start with wrangler
pnpm run build
wrangler pages dev .svelte-kit/cloudflare

# Visit: http://127.0.0.1:8788
# This uses Drizzle ORM with local D1
```

---

## Current Implementation Status

| Table         | Drizzle (Local) | REST API (Production) | Status        |
| ------------- | --------------- | --------------------- | ------------- |
| **clients**   | ✅ Full         | ✅ Full               | 100% Ready    |
| **users**     | ✅ Full         | ✅ Full               | 100% Ready    |
| **sports**    | ✅ Full         | ⏳ Pending            | Works locally |
| **leagues**   | ✅ Full         | ⏳ Pending            | Works locally |
| **divisions** | ✅ Full         | ⏳ Pending            | Works locally |
| **teams**     | ✅ Full         | ⏳ Pending            | Works locally |
| **rosters**   | ✅ Full         | ⏳ Pending            | Works locally |

---

## Summary

🎉 **Your database layer now works seamlessly across all environments!**

- ✅ Same code works locally and in production
- ✅ Automatic environment detection
- ✅ Type-safe operations everywhere
- ✅ Clients and Users fully functional on Vercel
- ✅ Progressive enhancement for other tables

**Deploy to Vercel with confidence!** 🚀
