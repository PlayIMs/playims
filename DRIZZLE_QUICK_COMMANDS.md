# Drizzle ORM Quick Command Reference

## Common Tasks

### Import Existing Tables from D1

```bash
# Automatically generate schema from existing database
pnpm drizzle-kit introspect

# Or manually view tables
wrangler d1 execute playims-central-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'"

# View specific table structure
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(table_name)"
```

### Rename a Column

```bash
# 1. Update src/lib/database/schema.ts with new name
# 2. Generate migration
pnpm run db:generate

# 3. Edit the migration file to use RENAME instead of DROP/ADD
# Change from:
#   DROP COLUMN old_name; ADD COLUMN new_name
# To:
#   RENAME COLUMN old_name TO new_name

# 4. Apply migration
pnpm run db:migrate
```

### Add a New Table

```bash
# 1. Add table to src/lib/database/schema.ts
# 2. Generate migration
pnpm run db:generate

# 3. Apply migration
pnpm run db:migrate

# 4. Add operations in operations.ts
# 5. Use it!
```

### View Database Contents

```bash
# List all tables
wrangler d1 execute playims-central-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'"

# View table data
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM table_name LIMIT 10"

# Count records
wrangler d1 execute playims-central-db-dev --command="SELECT COUNT(*) FROM table_name"

# Or use Drizzle Studio
pnpm run db:studio
```

### Migration Commands

```bash
# Generate new migration from schema changes
pnpm run db:generate

# Apply migrations to local database
pnpm run db:migrate

# Apply migrations to remote/production
wrangler d1 migrations apply playims-central-db-dev --remote

# List migrations
wrangler d1 migrations list playims-central-db-dev

# Push schema directly (skip migrations - dev only!)
pnpm run db:push
```

### Development

```bash
# Start regular dev server (Vercel deployment)
pnpm run dev

# Start with wrangler (local D1 testing)
pnpm run build
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25

# Launch Drizzle Studio (visual database browser)
pnpm run db:studio
```

### Database Inspection

```bash
# Show table structure
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(table_name)"

# Show table creation SQL
wrangler d1 execute playims-central-db-dev --command="SELECT sql FROM sqlite_master WHERE name='table_name'"

# Show all indexes
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM sqlite_master WHERE type='index'"

# Show foreign keys (if any)
wrangler d1 execute playims-central-db-dev --command="PRAGMA foreign_key_list(table_name)"
```

### Data Management

```bash
# Insert data
wrangler d1 execute playims-central-db-dev --command="INSERT INTO clients (name, email, created_at, updated_at) VALUES ('John', 'john@example.com', datetime('now'), datetime('now'))"

# Update data
wrangler d1 execute playims-central-db-dev --command="UPDATE clients SET name='Jane' WHERE id=1"

# Delete data
wrangler d1 execute playims-central-db-dev --command="DELETE FROM clients WHERE id=1"

# Clear table (keep structure)
wrangler d1 execute playims-central-db-dev --command="DELETE FROM table_name"

# Drop table (remove everything)
wrangler d1 execute playims-central-db-dev --command="DROP TABLE table_name"
```

### Troubleshooting

```bash
# Check wrangler version
wrangler version

# Update wrangler
npm install -g wrangler@latest

# List D1 databases
wrangler d1 list

# Check database info
wrangler d1 info playims-central-db-dev

# Kill Drizzle Studio if port is in use (Windows)
netstat -ano | findstr :4983
taskkill /F /PID <PID>

# Kill Drizzle Studio (Mac/Linux)
lsof -ti:4983 | xargs kill -9
```

### Type Generation

```bash
# Generate Wrangler types
wrangler types

# Generate Drizzle types (automatic when you define schema)
# Types are inferred from schema.ts using $inferSelect and $inferInsert
```

### Local D1 Database Location

```
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/66dc8c86b1da4882b259f7847ecf5350.sqlite
```

---

## Workflow Examples

### Adding a New Table

```bash
# 1. Edit src/lib/database/schema.ts
# Add: export const teams = sqliteTable('teams', { ... })

# 2. Generate migration
pnpm run db:generate

# 3. Review migration in src/lib/database/migrations/
# 4. Apply migration
pnpm run db:migrate

# 5. Add CRUD operations in operations.ts
# 6. Use the new table!
```

### Importing Existing Tables

```bash
# 1. Introspect database
pnpm drizzle-kit introspect

# 2. Review generated schema.ts
# 3. Add type exports for each table
# 4. Add operations in operations.ts
# 5. Start using!
```

### Fixing a Column Name Typo

```bash
# 1. Fix name in schema.ts
# 2. Generate migration
pnpm run db:generate

# 3. Edit migration to use RENAME COLUMN instead of DROP/ADD
# 4. Apply migration
pnpm run db:migrate

# 5. Verify
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(table_name)"
```

---

## Environment-Specific Commands

### Local Development

```bash
# Use regular dev server
pnpm run dev
# Access at: http://localhost:5173

# Or use wrangler (for Drizzle testing)
pnpm run build
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
# Access at: http://127.0.0.1:8788
```

### Production/Remote

```bash
# Apply migrations to production
wrangler d1 migrations apply playims-central-db-dev --remote

# Query production database
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM clients LIMIT 5" --remote

# Be careful with production!
```

---

## Quick File Locations

```
Project Structure:
├── drizzle.config.ts              # Drizzle configuration
├── src/lib/database/
│   ├── schema.ts                  # Table definitions
│   ├── drizzle.ts                 # Drizzle client
│   ├── operations.ts              # CRUD operations
│   ├── advanced-queries.ts        # Complex queries
│   └── migrations/                # Migration files
│       ├── 0000_xxx.sql          # Migration SQL
│       └── meta/                  # Migration metadata
└── wrangler.toml                  # D1 configuration
```

---

## Helpful Aliases (Optional)

Add to your `package.json` scripts for shortcuts:

```json
{
	"scripts": {
		"db:introspect": "drizzle-kit introspect",
		"db:view": "wrangler d1 execute playims-central-db-dev --command='SELECT name FROM sqlite_master WHERE type=\"table\"'",
		"db:reset": "wrangler d1 migrations apply playims-central-db-dev --remote && pnpm run db:migrate"
	}
}
```

---

Keep this file handy for quick reference! 🚀
