// Database Guide (Cloudflare D1 + Drizzle ORM)

This project uses **Cloudflare D1** as the database and **Drizzle ORM** for type-safe interaction.

## Structure

The database logic is modular and located in `src/lib/database/`:

- **`drizzle.ts`**: Configures the Drizzle client with the D1 binding.
- **`index.ts`**: Main entry point. Exports `DatabaseOperations`, schema, and types.
- **`schema/`**: Contains table definitions. One file per table (e.g., `clients.ts`, `users.ts`).
  - To add a table: Create a new file here and export it in `schema/index.ts`.
- **`operations/`**: Contains business logic classes (e.g., `ClientOperations`).
  - To add logic: Create a new operation class here and register it in `operations/index.ts`.

## Local Development

You can interact with the local D1 database using Wrangler and Drizzle Kit.

### Database Update Methods

There are three main ways to update your database. Understanding the difference is critical for maintaining a stable application.

#### 1. Via Migrations (✅ BEST / RECOMMENDED)
This is the standard, safe workflow for all environments (local, staging, production).

- **How**:
  1. Modify TypeScript schema files (`schema/*.ts`).
  2. Run `pnpm db:generate` to create a versioned SQL file.
  3. Run `pnpm db:migrate` to apply it.
- **Why it's the best**: 
  - Provides a history of changes.
  - Safe for production (you can review the SQL before applying).
  - Keeps local and production schemas in sync reliably.
  - Handles data transformations (like renames) without data loss if done correctly.
- **Use when**: Making *any* change to the database structure that needs to be deployed.

#### 2. Via `db:push` (⚠️ PROTOTYPING ONLY)
This bypasses migrations and forces the database to match your code.

- **How**: Run `pnpm db:push`.
- **Why it's risky**:
  - No history.
  - Can delete data silently if you aren't careful.
  - "It works on my machine" syndrome—production might fail because it doesn't have the same state.
- **Use when**: You are starting a brand new project, or hacking on a feature locally and don't care about keeping the data in your local DB. **NEVER use in production.**

#### 3. Via SQL (🚫 WORST / AVOID)
Manually running `CREATE TABLE` or `ALTER TABLE` commands.

- **How**: Using the D1 console in Cloudflare dashboard, or `wrangler d1 execute`.
- **Why it's the worst**:
  - **Breaks Type Safety**: Your TypeScript schema (`schema/*.ts`) will be out of sync with the real database. Drizzle won't know about your changes, leading to runtime errors.
  - **Unreproducible**: Hard to replicate the exact state on another developer's machine.
- **Use when**: Never, unless you are fixing a critical production emergency that migrations cannot handle (e.g., manual data repair). If you do this, you MUST immediately update your schema files to match.

### Syncing & Type Safety

The "Source of Truth" for your application is your TypeScript schema files in `src/lib/database/schema/`.

- **To sync DB → Code**: This flow is generally discouraged in this setup. You should define code first. If you have an existing DB, use `drizzle-kit introspect` to generate the initial schema, then switch to the migration workflow.
- **To sync Code → DB**: Use **Migrations** (Method 1).

**To ensure type safety:**
1. Always define your table structure in `src/lib/database/schema/`.
2. Do not bypass Drizzle to change the database structure.
3. If you get type errors, it means your code doesn't match your schema definition. Update the schema, generate a migration, and migrate.


## Common Operations

### Adding a New Table

1.  **Create Schema**: Add a new file `src/lib/database/schema/mytable.ts`.

    ```typescript
    import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

    export const myTable = sqliteTable('my_table', {
    	id: text().primaryKey(),
    	name: text()
    	// ...
    });

    export type MyTable = typeof myTable.$inferSelect;
    export type NewMyTable = typeof myTable.$inferInsert;
    ```

2.  **Export Schema**: Add `export * from './mytable.js';` to `src/lib/database/schema/index.ts`.
3.  **Generate Migration**: Run `pnpm db:generate`.
4.  **Create Operations**: Add `src/lib/database/operations/mytable.ts`.

    ```typescript
    import { eq } from 'drizzle-orm';
    import type { DrizzleClient } from '../drizzle.js';
    import { myTable, type MyTable } from '../schema/index.js';

    export class MyTableOperations {
    	constructor(private db: DrizzleClient) {}

    	async getAll() {
    		return await this.db.select().from(myTable);
    	}
    }
    ```

5.  **Register Operations**: Update `src/lib/database/operations/index.ts`.
    - Import `MyTableOperations`.
    - Add `public myTable: MyTableOperations;` to `DatabaseOperations` class.
    - Initialize `this.myTable = new MyTableOperations(drizzleDb);` in the constructor.

### Renaming a Column

1.  **Update Schema**: In your schema file (e.g., `schema/clients.ts`), change the column name in the database while keeping the property name if desired, or change both.
    ```typescript
    // Before: name: text('full_name')
    // After: name: text('display_name') 
    ```
2.  **Generate Migration**: Run `pnpm db:generate`.
3.  **Confirm Rename**: Drizzle Kit will ask: `? Did you rename column 'full_name' to 'display_name'?`. Select **Yes**.
4.  **Apply**: Run `pnpm db:migrate`.

### Adding a Column

1.  **Update Schema**: Add the new column definition.
    ```typescript
    age: integer('age')
    ```
2.  **Generate Migration**: Run `pnpm db:generate`.
3.  **Apply**: Run `pnpm db:migrate`.

### Removing a Column

1.  **Update Schema**: Remove the column definition from the file.
2.  **Generate Migration**: Run `pnpm db:generate`.
    *   *Warning*: This will generate a `DROP COLUMN` statement. All data in that column will be lost.
3.  **Apply**: Run `pnpm db:migrate`.

### Renaming a Table

1.  **Update Schema**: Change the table name in the `sqliteTable` definition.
    ```typescript
    export const newName = sqliteTable('new_table_name', { ... })
    ```
2.  **Generate Migration**: Run `pnpm db:generate`.
3.  **Confirm Rename**: Drizzle Kit will detect the rename and ask for confirmation. Select **Yes**.
4.  **Apply**: Run `pnpm db:migrate`.

## Type Safety

Always import types from `$lib/database` (which re-exports from `schema/index.ts`):

```typescript
import type { Client, NewClient } from '$lib/database';
```

- **`Client`**: The shape of data read _from_ the database (output).
- **`NewClient`**: The shape of data used to _insert_ into the database (input).

## ⚠️ Warnings & Cautions (Best Practices)

Failing to follow these guidelines can lead to data loss, deployment failures, or inconsistent application state.

### 🚫 DO NOT: Modify Migrations Manually
- **Why**: Migration files (`.sql`) are generated by Drizzle based on your schema. If you edit them manually, the `meta/_journal.json` file will become out of sync with the actual migration content.
- **Consequence**: Drizzle Kit might fail to apply future migrations or try to re-apply changes, causing errors.
- **Correct Way**: Modify the TypeScript schema files (`src/lib/database/schema/*.ts`), then run `pnpm db:generate`.

### 🚫 DO NOT: Use `db:push` in Production
- **Why**: `db:push` forces the database schema to match your local code *immediately*, bypassing the migration history system.
- **Consequence**: You lose the ability to roll back changes safely. It can also accidentally delete data if you rename columns without proper migration steps.
- **Correct Way**: Always use `db:generate` and `db:migrate` for any environment that matters.

### ⚠️ CAUTION: Renaming Columns
- **Why**: Drizzle may interpret a renamed column as "Drop Column A" + "Add Column B", which **deletes the data** in that column.
- **Correct Way**: When generating a migration after a rename, Drizzle Kit will ask you if you renamed the column. **Answer YES**. Inspect the generated SQL file to ensure it uses `ALTER TABLE ... RENAME COLUMN` instead of `DROP` / `ADD`.

### ⚠️ CAUTION: Breaking Foreign Keys
- **Why**: SQLite (and D1) enforces foreign key constraints. If you delete a record that is referenced by another table (e.g., deleting a `Client` that has `Users`), the operation will fail.
- **Correct Way**: 
  - Ensure your schema definitions include `onDelete: 'cascade'` if you want automatic deletion.
  - Or, manually delete child records (e.g., delete all `Users` for a `Client`) before deleting the parent record in your operation logic.

### ⚠️ CAUTION: Mixing Local and Production Data
- **Why**: Your local environment uses a local SQLite file (simulating D1). Production uses the real Cloudflare D1.
- **Consequence**: Data you create locally (via `pnpm dev` or `pnpm db:studio`) **will not exist** in production, and vice versa.
- **Correct Way**: Use migration files to keep the *structure* in sync. Use seed scripts if you need consistent initial data across environments.

