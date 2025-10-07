# Importing Existing D1 Tables into Drizzle Schema

## Option 1: Drizzle Kit Introspect (Recommended)

Drizzle Kit can automatically generate TypeScript schema from your existing database!

### Step 1: Pull Schema from Database

```bash
pnpm drizzle-kit introspect
```

This command:

- Connects to your D1 database
- Reads all existing tables
- Generates TypeScript schema code
- Creates the schema in `src/lib/database/schema.ts`

### Step 2: Review the Generated Schema

Check `src/lib/database/schema.ts` - it will have all your tables!

Example output:

```typescript
// Auto-generated from your existing database
export const clients = sqliteTable('clients', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull()
	// ... all your existing columns!
});

// Add type exports
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
```

---

## Option 2: Manual Schema from SQL (Alternative)

If introspect doesn't work, you can view your tables and manually add them:

### Step 1: View Your Tables

```bash
# See all tables
wrangler d1 execute playims-central-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'"

# See structure of a specific table
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(your_table_name)"
```

### Step 2: Manually Add to Schema

Based on the output, manually create the table definition in `src/lib/database/schema.ts`.

---

## After Importing Tables

Once your schema is updated, you need to:

### 1. Generate Baseline Migration

```bash
pnpm run db:generate
```

This creates migration files matching your current database state.

### 2. Mark Migrations as Applied (If Already in DB)

Since these tables already exist in your database, you need to tell Drizzle they're already applied:

```bash
# Mark migrations as applied without running them
wrangler d1 migrations list playims-central-db-dev
```

Then manually update the migration metadata to mark them as complete.

### 3. Add Operations for New Tables

Edit `src/lib/database/operations.ts` and add CRUD methods for each new table.

---

## Example: Complete Workflow

```bash
# 1. Pull existing schema from D1
pnpm drizzle-kit introspect

# 2. Review generated schema.ts
# Edit src/lib/database/schema.ts to add type exports

# 3. Generate migration files
pnpm run db:generate

# 4. Since tables already exist, you may need to handle migration state
# Check if migrations need to be applied or marked as done

# 5. Add operations in operations.ts for new tables
```

---

## Handling the Migration State

**Important:** If tables already exist in your D1 database, you have two options:

### Option A: Skip Migration (Recommended if tables exist)

Don't run `pnpm run db:migrate` because the tables are already there. Just:

1. Generate the schema with `introspect`
2. Add type exports
3. Add operations
4. Start using Drizzle!

### Option B: Fresh Start (If you want clean slate)

```bash
# Drop all tables (WARNING: deletes all data!)
wrangler d1 execute playims-central-db-dev --command="DROP TABLE IF EXISTS table1"
wrangler d1 execute playims-central-db-dev --command="DROP TABLE IF EXISTS table2"

# Then run migrations fresh
pnpm run db:migrate
```

---

## Quick Command Reference

```bash
# Introspect database → generate schema
pnpm drizzle-kit introspect

# List all tables in D1
wrangler d1 execute playims-central-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'"

# Show table structure
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(table_name)"

# Show table creation SQL
wrangler d1 execute playims-central-db-dev --command="SELECT sql FROM sqlite_master WHERE name='table_name'"
```

---

## TypeScript Type Exports

After introspection, don't forget to add type exports for each table:

```typescript
// For each table, add these:
export type TableName = typeof tableName.$inferSelect;
export type NewTableName = typeof tableName.$inferInsert;
```

This gives you full type safety for all your existing tables!
