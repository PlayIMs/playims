# Drizzle Studio Setup for D1

## ✅ Issue Resolved!

Drizzle Studio now has the correct database credentials configured and required dependencies installed.

## What Was Fixed

Two issues were resolved:

1. **Missing `dbCredentials`** - `drizzle.config.ts` was missing the database connection configuration
2. **Missing `better-sqlite3`** - Drizzle Studio needs this package to connect to SQLite databases

### Dependencies Installed

```bash
pnpm add -D @libsql/client
```

This installs the SQLite driver that Drizzle Studio uses to connect to your local database file. We use `@libsql/client` instead of `better-sqlite3` because:

- No native bindings required (pure JavaScript)
- Works reliably on Windows with pnpm
- Fully compatible with SQLite/D1 databases

### Updated Configuration

Your `drizzle.config.ts` now includes:

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

## How to Use Drizzle Studio

### 1. Launch Drizzle Studio

```bash
pnpm run db:studio
```

This will:

- Start Drizzle Studio server
- Open your browser at `https://local.drizzle.studio`
- Connect to your local D1 database

### 2. What You Can Do in Drizzle Studio

✅ **Browse Tables** - View all your tables and their structure  
✅ **View Data** - See all records in each table  
✅ **Add Records** - Insert new data through the UI  
✅ **Edit Records** - Modify existing data  
✅ **Delete Records** - Remove records  
✅ **Run Queries** - Execute custom SQL queries  
✅ **Inspect Schema** - View column types, indexes, constraints

### 3. Example: Adding Data

Once Drizzle Studio opens:

1. Click on the **`clients`** table
2. Click **"Add Row"**
3. Fill in the fields:
   - `name`: John Doe
   - `email`: john@example.com
   - `created_at`: 2025-01-06T12:00:00Z (or use current timestamp)
   - `updated_at`: 2025-01-06T12:00:00Z
4. Click **"Save"**

The `id` field will be auto-generated!

## Important Notes

### Local Database File Location

The database file is stored at:

```
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/66dc8c86b1da4882b259f7847ecf5350.sqlite
```

This is the **local development database** created by wrangler. It's separate from your production D1 database on Cloudflare.

### Database Must Exist First

If you get an error that the database file doesn't exist:

```bash
# Apply migrations to create the local database
pnpm run db:migrate

# Then try studio again
pnpm run db:studio
```

### Changes Are Local Only

**Important:** Changes made in Drizzle Studio only affect your **local development database**. They do NOT affect:

- Your production D1 database on Cloudflare
- Other developers' local databases

### Production Database Management

To manage your production D1 database, use wrangler commands:

```bash
# Query production database
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM clients" --remote

# Insert data into production
wrangler d1 execute playims-central-db-dev --command="INSERT INTO clients (name, email, created_at, updated_at) VALUES ('John', 'john@example.com', datetime('now'), datetime('now'))" --remote
```

## Troubleshooting

### Studio Won't Open

If the browser doesn't open automatically:

1. Look for the URL in the terminal output
2. Manually open: `https://local.drizzle.studio`

### Can't Connect to Database

If you see connection errors:

1. Make sure migrations are applied: `pnpm run db:migrate`
2. Check that the database file exists at the path in `drizzle.config.ts`
3. Try restarting the studio

### Changes Not Saving

If your changes aren't persisting:

1. Check for validation errors (unique constraints, required fields)
2. Make sure you clicked "Save"
3. Check the browser console for errors

### Port Already in Use

If you get a port error:

1. Close any other Drizzle Studio instances
2. Change the port: `pnpm run db:studio -- --port 4983`

## Alternative: Using wrangler Commands

If Drizzle Studio doesn't work for you, you can use wrangler to manage data:

```bash
# View all clients
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM clients"

# Add a client
wrangler d1 execute playims-central-db-dev --command="INSERT INTO clients (name, email, created_at, updated_at) VALUES ('John Doe', 'john@example.com', datetime('now'), datetime('now'))"

# Update a client
wrangler d1 execute playims-central-db-dev --command="UPDATE clients SET name='Jane Doe' WHERE id=1"

# Delete a client
wrangler d1 execute playims-central-db-dev --command="DELETE FROM clients WHERE id=1"
```

## Summary

✅ **Configuration Fixed** - `drizzle.config.ts` now has `dbCredentials`  
✅ **Studio Ready** - Run `pnpm run db:studio` anytime  
✅ **Local Development** - Manage your local database visually  
✅ **Production Separate** - Use wrangler for production data

Enjoy your visual database management! 🎨
