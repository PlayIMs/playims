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

## Local vs. Production Development

This project uses Cloudflare D1. It is important to understand the difference between **Local** and **Remote (Production)** databases.

*   **Local**: A SQLite file stored in your `.wrangler` directory. It is used when running `pnpm dev` or `wrangler pages dev`. It simulates D1 for development speed and safety.
*   **Remote**: The actual D1 database running on Cloudflare's edge. This is your production data.

### Database Management Commands

The following commands are used to manage the database schema.

#### 1. Generate Migrations
```bash
pnpm db:generate
```
- **What it does**: Scans your TypeScript schema files (`src/lib/database/schema/`) and creates a SQL migration file in `migrations/`.
- **Target**: **Codebase** (Filesystem).
- **When to use**: Every time you change your schema definition.

#### 2. Apply Migrations (Production)
```bash
pnpm db:migrate
```
- **What it does**: Applies pending migrations to your **REMOTE** Cloudflare D1 database.
- **Target**: **Production Database** (Cloudflare).
- **Command**: Runs `wrangler d1 migrations apply`.
- **When to use**: When you are ready to deploy schema changes to the live application.

#### 3. Apply Migrations (Local)
```bash
pnpm db:migrate --local
```
- **What it does**: Applies pending migrations to your **LOCAL** development database.
- **Target**: **Local Database** (`.wrangler/`).
- **When to use**: After generating migrations, so your local dev environment (`pnpm dev`) reflects the changes.

#### 4. Drizzle Studio (Remote)
```bash
pnpm db:studio
```
- **What it does**: Opens a GUI to inspect and edit your database.
- **Target**: **Production Database** (by default, via `drizzle.config.ts`).
- **Warning**: This connects to your live production data! Be careful.

#### 5. Push Schema (Prototyping)
```bash
pnpm db:push
```
- **What it does**: Forces the **Remote** database to match your local schema code, bypassing migration files.
- **Target**: **Production Database** (via `drizzle.config.ts`).
- **Warning**: **Do not use this in production workflows.** It can cause data loss. It is primarily for rapid prototyping where you don't care about the data or migration history.

---

### Syncing & Type Safety

To ensure your application types match your database:

1.  **Define**: Update schema in `src/lib/database/schema/*.ts`.
2.  **Generate**: Run `pnpm db:generate` to create the SQL.
3.  **Migrate**: Run `pnpm db:migrate --local` (for dev) and `pnpm db:migrate` (for prod).

**Note**: The source of truth is always your TypeScript schema files.

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
    age: integer('age');
    ```
2.  **Generate Migration**: Run `pnpm db:generate`.
3.  **Apply**: Run `pnpm db:migrate`.

### Removing a Column

1.  **Update Schema**: Remove the column definition from the file.
2.  **Generate Migration**: Run `pnpm db:generate`.
    - _Warning_: This will generate a `DROP COLUMN` statement. All data in that column will be lost.
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

- **Why**: `db:push` forces the database schema to match your local code _immediately_, bypassing the migration history system.
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
- **Correct Way**: Use migration files to keep the _structure_ in sync. Use seed scripts if you need consistent initial data across environments.
