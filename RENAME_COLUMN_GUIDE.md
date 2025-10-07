# How to Rename a Column with Drizzle Migrations

## The Problem

You made a typo in a column name and want to fix it. For example:

- Typo: `emial` → Should be: `email`
- Or: `user_nmae` → Should be: `user_name`

---

## Method 1: Using Drizzle Migrations (Recommended)

### Step 1: Update the Schema

Edit `src/lib/database/schema.ts` and fix the column name:

```typescript
export const clients = sqliteTable('clients', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(), // ← Fixed from 'emial'
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});
```

### Step 2: Generate Migration

```bash
pnpm run db:generate
```

Drizzle will detect the change and ask what happened. It might:

- Ask if you renamed the column
- Or think you deleted one and added another

**Important:** Drizzle Kit may not always detect renames correctly in SQLite.

### Step 3: Edit the Generated Migration

Open the new migration file in `src/lib/database/migrations/` and you'll see something like:

```sql
-- Drizzle might generate this (WRONG):
ALTER TABLE `clients` DROP COLUMN `emial`;
ALTER TABLE `clients` ADD COLUMN `email` text NOT NULL;
```

**This would delete your data!** Change it to:

```sql
-- Correct way to rename in SQLite:
ALTER TABLE `clients` RENAME COLUMN `emial` TO `email`;
```

### Step 4: Apply Migration

```bash
pnpm run db:migrate
```

Your column is now renamed!

---

## Method 2: Manual SQL Migration (More Control)

Sometimes it's easier to write the migration yourself.

### Step 1: Create Migration Manually

Create a new file in `src/lib/database/migrations/`:

```
0002_rename_column.sql
```

### Step 2: Write the SQL

```sql
-- Rename column from emial to email
ALTER TABLE `clients` RENAME COLUMN `emial` TO `email`;
```

### Step 3: Update Migration Metadata

Edit `src/lib/database/migrations/meta/_journal.json` and add your migration:

```json
{
	"version": "7",
	"dialect": "sqlite",
	"entries": [
		{
			"idx": 0,
			"version": "6",
			"when": 1759707451027,
			"tag": "0000_wise_the_hand",
			"breakpoints": true
		},
		{
			"idx": 1,
			"version": "6",
			"when": 1759800000000,
			"tag": "0002_rename_column",
			"breakpoints": true
		}
	]
}
```

### Step 4: Update Your Schema

Edit `src/lib/database/schema.ts` with the corrected name:

```typescript
export const clients = sqliteTable('clients', {
	// ... other columns ...
	email: text('email').notNull().unique() // ← Corrected
});
```

### Step 5: Apply Migration

```bash
pnpm run db:migrate
```

---

## Method 3: Direct Database Update (Quick Fix)

For development databases, you can rename directly:

```bash
# Rename column directly
wrangler d1 execute playims-central-db-dev --command="ALTER TABLE clients RENAME COLUMN emial TO email"
```

Then update your schema to match:

```typescript
// src/lib/database/schema.ts
export const clients = sqliteTable('clients', {
	// ... other columns ...
	email: text('email').notNull().unique() // ← Update schema to match DB
});
```

**Warning:** This doesn't create a migration, so other developers or production won't get the change!

---

## SQLite RENAME COLUMN Limitations

SQLite's `RENAME COLUMN` was added in SQLite 3.25.0 (2018). If you have an older version:

### Alternative: Recreate Table

```sql
-- 1. Create new table with correct column name
CREATE TABLE clients_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,  -- ← Correct name
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Copy data from old table
INSERT INTO clients_new (id, name, email, created_at, updated_at)
SELECT id, name, emial, created_at, updated_at FROM clients;

-- 3. Drop old table
DROP TABLE clients;

-- 4. Rename new table
ALTER TABLE clients_new RENAME TO clients;

-- 5. Recreate indexes
CREATE UNIQUE INDEX clients_email_unique ON clients(email);
```

---

## Complete Example: Fixing a Typo

Let's say you have `user_nmae` and want `user_name`:

### 1. Update Schema

```typescript
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userName: text('user_name').notNull(), // ← Fixed from 'user_nmae'
	email: text('email').notNull().unique()
});
```

### 2. Generate Migration

```bash
pnpm run db:generate
```

### 3. Edit Migration File

Find the new migration in `src/lib/database/migrations/` and ensure it says:

```sql
-- Rename column
ALTER TABLE `users` RENAME COLUMN `user_nmae` TO `user_name`;
```

**Not:**

```sql
-- DON'T LET IT DO THIS:
-- ALTER TABLE `users` DROP COLUMN `user_nmae`;
-- ALTER TABLE `users` ADD COLUMN `user_name` text NOT NULL;
```

### 4. Apply Migration

```bash
pnpm run db:migrate
```

### 5. Verify

```bash
# Check the table structure
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(users)"
```

---

## Best Practices

✅ **DO:**

- Always review generated migrations before applying
- Test migrations on local database first
- Use `ALTER TABLE RENAME COLUMN` when possible
- Keep schema.ts in sync with database

❌ **DON'T:**

- Don't drop and recreate columns with data
- Don't apply untested migrations to production
- Don't manually edit the database without creating a migration
- Don't forget to update TypeScript types

---

## Testing Your Migration

Before applying to production:

```bash
# 1. Apply locally
pnpm run db:migrate

# 2. Check table structure
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(table_name)"

# 3. Query some data to verify
wrangler d1 execute playims-central-db-dev --command="SELECT * FROM table_name LIMIT 5"

# 4. If good, apply to production
wrangler d1 migrations apply playims-central-db-dev --remote
```

---

## Rollback if Something Goes Wrong

If you need to undo:

```bash
# You can't automatically rollback with Drizzle
# You'll need to create a new migration that reverses the change

# Create reverse migration
ALTER TABLE `clients` RENAME COLUMN `email` TO `emial`;
```

Then generate and apply the reverse migration.

---

## Summary

**Quick Fix (Dev Only):**

```bash
wrangler d1 execute playims-central-db-dev --command="ALTER TABLE table_name RENAME COLUMN old_name TO new_name"
```

**Proper Way (With Migration):**

1. Edit `schema.ts` with correct name
2. Run `pnpm run db:generate`
3. Edit generated migration to use `RENAME COLUMN`
4. Run `pnpm run db:migrate`
5. Verify with `PRAGMA table_info`

**Type Safety Bonus:**
Once renamed in schema, TypeScript immediately knows about the new column name! 🎉
