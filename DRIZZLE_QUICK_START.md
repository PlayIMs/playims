# Drizzle ORM Quick Start Guide 🚀

## ✅ Installation Complete!

Your project now has Drizzle ORM fully integrated with Cloudflare D1.

## 📦 What's Included

- **drizzle-orm** - Type-safe ORM
- **drizzle-kit** - Database toolkit & migrations
- **@cloudflare/workers-types** - D1 TypeScript types

## 🚀 Quick Commands

```bash
# Apply migrations to D1
pnpm run db:migrate

# Generate new migration from schema changes
pnpm run db:generate

# Launch Drizzle Studio (database browser)
pnpm run db:studio

# Push schema directly (dev only - skips migrations)
pnpm run db:push

# Build and run with Drizzle + D1
pnpm run build
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

## 📝 Basic Usage

### In a SvelteKit Load Function

```typescript
import { DatabaseOperations } from '$lib/database/operations.js';

export const load = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);
	const clients = await dbOps.getAllClients();
	return { clients };
};
```

### In an API Endpoint

```typescript
import { DatabaseOperations } from '$lib/database/operations.js';
import { json } from '@sveltejs/kit';

export const POST = async ({ request, platform }) => {
	const data = await request.json();
	const dbOps = new DatabaseOperations(platform);
	const client = await dbOps.createClient(data);
	return json({ success: true, data: client });
};
```

## 🔧 Available Operations

### Clients

```typescript
const dbOps = new DatabaseOperations(platform);

await dbOps.getAllClients();
await dbOps.getClientById(1);
await dbOps.createClient({ name: 'John', email: 'john@example.com' });
await dbOps.updateClient(1, { name: 'Jane' });
await dbOps.deleteClient(1);
```

### Users

```typescript
await dbOps.getAllUsers();
await dbOps.getUserById(1);
await dbOps.createUser({ username: 'john', email: 'john@example.com' });
await dbOps.updateUser(1, { username: 'jane' });
await dbOps.deleteUser(1);
```

### Advanced Queries

```typescript
import { AdvancedQueries } from '$lib/database/advanced-queries.js';

const queries = new AdvancedQueries(platform);

await queries.searchClients('john');
await queries.getRecentClients();
await queries.getStats();
await queries.getClientsByDomain('example.com');
```

## 🔄 Schema Changes Workflow

1. **Edit schema** in `src/lib/database/schema.ts`
2. **Generate migration**: `pnpm run db:generate`
3. **Apply migration**: `pnpm run db:migrate`
4. **Update types**: `wrangler types`

## 📂 File Structure

```
playims/
├── drizzle.config.ts                      # Drizzle Kit config
├── src/lib/database/
│   ├── schema.ts                          # Database schema
│   ├── drizzle.ts                         # Drizzle client
│   ├── operations.ts                      # CRUD operations
│   ├── advanced-queries.ts                # Complex queries
│   └── migrations/                        # Migration files
└── src/routes/api/drizzle-example/
    └── +server.ts                         # Example endpoint
```

## 💡 Type Safety

Drizzle provides full TypeScript inference:

```typescript
import type { Client, NewClient } from '$lib/database/schema.js';

// Client has: id, name, email, createdAt, updatedAt
const client: Client = await dbOps.getClientById(1);

// NewClient omits auto-generated fields
const newClient: NewClient = {
	name: 'John',
	email: 'john@example.com',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};
```

## 🎨 Drizzle Studio

Visual database management tool:

```bash
pnpm run db:studio
```

Opens at `https://local.drizzle.studio` with:

- Table browser
- Data editor
- Query runner
- Schema inspector

## 🔍 Example: Adding a New Field

```typescript
// 1. Edit src/lib/database/schema.ts
export const clients = sqliteTable('clients', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	phone: text('phone'), // NEW FIELD
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

// 2. Generate migration
// pnpm run db:generate

// 3. Apply migration
// pnpm run db:migrate

// 4. TypeScript now knows about 'phone'!
const client = await dbOps.createClient({
	name: 'John',
	email: 'john@example.com'
	// phone is optional (not required by schema)
});
```

## 🐛 Troubleshooting

### Error: "Production D1 REST API support required"

**Solution**: Use `wrangler pages dev` for local development:

```bash
pnpm run build
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

### Error: "Cannot find module './$types'"

**Solution**: Build your project first:

```bash
pnpm run build
```

### Migration Not Applied

**Solution**: Ensure database name matches in `wrangler.toml`:

```bash
pnpm run db:migrate
```

## 📚 Documentation

- **Full Guide**: See `DRIZZLE_INTEGRATION.md`
- **Drizzle Docs**: https://orm.drizzle.team
- **D1 Docs**: https://developers.cloudflare.com/d1

## 🎉 Ready to Go!

Start using type-safe database operations:

```bash
pnpm run db:migrate  # Apply migrations
pnpm run build       # Build project
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

Then visit: `http://localhost:8788/api/drizzle-example`
