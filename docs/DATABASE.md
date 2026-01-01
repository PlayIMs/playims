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

### Database Management

The following commands are used to manage the Cloudflare D1 database. They utilize `drizzle-kit` to handle schema changes and migrations.

#### 1. Generate Migrations
```bash
pnpm db:generate
```
- **What it does**: Scans your TypeScript schema files in `src/lib/database/schema/` and compares them against the last known state of your migrations. If it detects changes (e.g., a new table, a renamed column), it generates a new SQL migration file.
- **Files Created**: Adds a new `.sql` file in `src/lib/database/migrations/`.
- **When to use**: Run this **every time** you modify your TypeScript schema files.
- **Why**: This creates a version-controlled history of your database structure, allowing you to safely apply changes to different environments (local, production).

#### 2. Apply Migrations (Local)
```bash
pnpm db:migrate
```
- **What it does**: Connects to your **local** D1 database (simulated by Wrangler) and applies any pending SQL migration files from `src/lib/database/migrations/`.
- **Files Affected**: Updates the local SQLite database file (usually located in `.wrangler/`).
- **When to use**: Run this after `pnpm db:generate` to update your local development database with the new schema.
- **Why**: Keeps your local database in sync with your code so you can test your changes immediately.

#### 3. Drizzle Studio
```bash
pnpm db:studio
```
- **What it does**: Launches a local web server that provides a graphical user interface (GUI) for your database.
- **End Product**: Opens a tab in your browser where you can view tables, browse rows, insert data, and run SQL queries visually.
- **When to use**: Use this whenever you want to inspect your data, verify that an operation worked, or manually edit data during testing.
- **Why**: It's much faster and more intuitive than writing manual SQL `SELECT` queries in the terminal to check your data.

#### 4. Push Schema (Prototyping)
```bash
pnpm db:push
```
- **What it does**: Directly modifies the database schema to match your TypeScript files **without** creating a migration file.
- **Files Affected**: Updates the database directly; does NOT create `.sql` files.
- **When to use**: Only during **rapid prototyping** when you are experimenting with schema designs and don't want to clutter your project with dozens of migration files for every small tweak.
- **Warning**: Do not use this for production databases or stable features, as you lose the version history of your schema changes.


## Adding a New Table

1.  **Create Schema**: Add `src/lib/database/schema/mytable.ts`.

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

