# Drizzle + D1 Troubleshooting Guide

## Common Issues and Solutions

### ❌ Error: "No migrations folder found"

**Error Message:**

```
▲ [WARNING] No migrations folder found. Set `migrations_dir` in your wrangler.toml
X [ERROR] No migrations present at C:\...\migrations
```

**Solution:**
Add `migrations_dir` to your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "playims-central-db-dev"
database_id = "66dc8c86-b1da-4882-b259-f7847ecf5350"
migrations_dir = "src/lib/database/migrations"  # Add this!
```

Then run: `pnpm run db:migrate`

---

### ❌ Error: "Cannot find module './$types'"

**Error Message:**

```
Cannot find module './$types' or its corresponding type declarations
```

**Solution:**
Build your SvelteKit project first to generate type definitions:

```bash
pnpm run build
```

This creates the `.svelte-kit` directory with generated types.

---

### ❌ Error: "Production D1 REST API support required"

**Error Message:**

```
Production D1 REST API support requires additional setup.
Use wrangler pages dev for local development with Drizzle.
```

**Solution:**
Drizzle requires a D1 database binding. Use wrangler for local development:

```bash
pnpm run build
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

Don't use `pnpm run dev` - use the wrangler command above instead.

---

### ❌ Error: "Cannot find name 'D1Database'"

**Error Message:**

```
Cannot find name 'D1Database'. Did you mean 'IDBDatabase'?
```

**Solution:**
Install Cloudflare Workers types:

```bash
pnpm add -D @cloudflare/workers-types
```

Then import it in your files:

```typescript
import type { D1Database } from '@cloudflare/workers-types';
```

---

### ❌ Warning: "Unexpected fields found in build field"

**Warning Message:**

```
▲ [WARNING] Processing wrangler.toml configuration:
  - Unexpected fields found in build field: "environment_variables"
```

**Solution:**
Remove the `[build.environment_variables]` section from `wrangler.toml`:

```toml
# Before (❌)
[build]
command = "pnpm run build"

[build.environment_variables]
NODE_VERSION = "20"

# After (✅)
[build]
command = "pnpm run build"
```

---

### ❌ Migration Already Applied

**Error Message:**

```
X [ERROR] Migration already applied: 0000_wise_the_hand.sql
```

**Solution:**
This means your migration was already successfully applied. No action needed!

To see migration status:

```bash
wrangler d1 migrations list playims-central-db-dev
```

---

### ❌ Drizzle Studio: "Please install either 'better-sqlite3' or '@libsql/client'"

**Error Message:**

```
Please install either 'better-sqlite3' or '@libsql/client' for Drizzle Kit to connect to SQLite databases
```

**Solution:**
Install `better-sqlite3`:

```bash
pnpm add -D better-sqlite3 @types/better-sqlite3
pnpm rebuild better-sqlite3
```

Then try again:

```bash
pnpm run db:studio
```

---

### ❌ Drizzle Studio: "Please specify a 'dbCredentials' param"

**Error Message:**

```
Invalid input  Please specify a 'dbCredentials' param in config.
```

**Solution:**
Add `dbCredentials` to your `drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/database/schema.ts',
	out: './src/lib/database/migrations',
	dialect: 'sqlite',
	dbCredentials: {
		// Point to local D1 database file created by wrangler
		url: './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/66dc8c86b1da4882b259f7847ecf5350.sqlite'
	},
	verbose: true,
	strict: true
});
```

**Note:** The database file is created by wrangler when you run migrations. If the file doesn't exist yet:

1. Run `pnpm run db:migrate` first
2. Then try `pnpm run db:studio`

---

### ❌ Drizzle Studio: "address already in use" (EADDRINUSE)

**Error Message:**

```
Error: listen EADDRINUSE: address already in use 127.0.0.1:4983
```

**Solution:**
A previous Drizzle Studio instance is still running. Kill it and restart:

**Windows:**

```bash
# Step 1: Find the process using port 4983
netstat -ano | findstr :4983
```

You'll see output like this:

```
TCP    127.0.0.1:4983    0.0.0.0:0    LISTENING    16344
                                                    ^^^^^
                                                    This is the PID!
```

The **last number on the LISTENING line** is the Process ID (PID).

```bash
# Step 2: Kill the process (use the PID from above)
taskkill /F /PID 16344

# Step 3: Restart studio
pnpm run db:studio
```

**Mac/Linux:**

```bash
# Find and kill the process using port 4983
lsof -ti:4983 | xargs kill -9

# Restart studio
pnpm run db:studio
```

---

### ❌ Drizzle Studio Not Loading

**Issue:**
Running `pnpm run db:studio` but the browser doesn't open or shows errors.

**Solution:**

1. Make sure your schema file is correct
2. Check that `drizzle.config.ts` points to the right schema:
   ```typescript
   schema: './src/lib/database/schema.ts';
   ```
3. Ensure the local database file exists (run `pnpm run db:migrate` first)
4. Check if another instance is running (see EADDRINUSE error above)
5. Try closing and reopening the studio

---

### ❌ Type Errors in Operations

**Issue:**
TypeScript errors when using `DatabaseOperations` or `AdvancedQueries`.

**Solution:**
Make sure you're passing the platform object:

```typescript
// ✅ Correct
export const load = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);
	// ...
};

// ❌ Wrong
export const load = async () => {
	const dbOps = new DatabaseOperations(); // Missing platform!
	// ...
};
```

---

### ❌ Can't Connect to Local Database

**Issue:**
Queries fail when using `wrangler pages dev`.

**Solution:**

1. Make sure you built first: `pnpm run build`
2. Check that `wrangler.toml` has correct database config:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "playims-central-db-dev"
   database_id = "66dc8c86-b1da-4882-b259-f7847ecf5350"
   ```
3. Try applying migrations again: `pnpm run db:migrate`

---

### ❌ Schema Changes Not Reflected

**Issue:**
Made changes to `schema.ts` but they don't appear in the database.

**Solution:**
Follow the migration workflow:

```bash
# 1. Generate migration
pnpm run db:generate

# 2. Apply migration
pnpm run db:migrate

# 3. Rebuild (if needed)
pnpm run build

# 4. Update types
wrangler types
```

---

### ❌ PNPM Command Not Found

**Error Message:**

```
'pnpm' is not recognized as an internal or external command
```

**Solution:**
Install pnpm globally:

```bash
npm install -g pnpm
```

Or use npx:

```bash
npx pnpm run db:migrate
```

---

## Debug Checklist

If you're experiencing issues, check these in order:

1. ✅ Dependencies installed: `pnpm install`
2. ✅ Migrations directory configured in `wrangler.toml`
3. ✅ Migrations applied: `pnpm run db:migrate`
4. ✅ Project built: `pnpm run build`
5. ✅ Using wrangler dev (not `pnpm run dev`)
6. ✅ Database binding name matches (`DB`)

---

## Getting Help

If you're still stuck:

1. Check the main guides:
   - `DRIZZLE_QUICK_START.md`
   - `DRIZZLE_INTEGRATION.md`
   - `MIGRATION_SUCCESS.md`

2. Check Drizzle docs: https://orm.drizzle.team
3. Check D1 docs: https://developers.cloudflare.com/d1
4. Check wrangler docs: https://developers.cloudflare.com/workers/wrangler/

---

## Useful Commands

```bash
# Check migration status
wrangler d1 migrations list playims-central-db-dev

# Query database directly
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM clients"

# List all databases
wrangler d1 list

# Check wrangler version
wrangler version

# Update wrangler
npm install -g wrangler@latest
```

---

## Reset Everything (Nuclear Option)

If nothing works and you want to start fresh:

```bash
# 1. Remove node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 2. Clean build artifacts
rm -rf .svelte-kit

# 3. Drop all tables (WARNING: deletes all data!)
wrangler d1 execute playims-central-db-dev --command="DROP TABLE IF EXISTS clients"
wrangler d1 execute playims-central-db-dev --command="DROP TABLE IF EXISTS users"

# 4. Reapply migrations
pnpm run db:migrate

# 5. Rebuild
pnpm run build
```

---

Good luck! 🍀
