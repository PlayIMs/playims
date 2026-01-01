# Database Guide (Cloudflare D1 + Drizzle ORM)

This project uses **Cloudflare D1** as the database and **Drizzle ORM** for type-safe interaction.

## Structure

The database logic is modular and located in `src/lib/database/`:

*   **`drizzle.ts`**: Configures the Drizzle client with the D1 binding.
*   **`index.ts`**: Main entry point. Exports `DatabaseOperations`, schema, and types.
*   **`schema/`**: Contains table definitions. One file per table (e.g., `clients.ts`, `users.ts`).
    *   To add a table: Create a new file here and export it in `schema/index.ts`.
*   **`operations/`**: Contains business logic classes (e.g., `ClientOperations`).
    *   To add logic: Create a new operation class here and register it in `operations/index.ts`.

## Local Development

You can interact with the local D1 database using Wrangler and Drizzle Kit.

### Common Commands

*   **Generate Migrations**: Create SQL migration files based on schema changes.
    ```bash
    pnpm db:generate
    ```
*   **Apply Migrations (Local)**: Apply migrations to the local D1 database.
    ```bash
    pnpm db:migrate
    ```
*   **Drizzle Studio**: Open a visual database editor in your browser.
    ```bash
    pnpm db:studio
    ```
*   **Push Schema (Prototyping)**: Push schema changes directly without migrations (use carefully).
    ```bash
    pnpm db:push
    ```

## Adding a New Table

1.  **Create Schema**: Add `src/lib/database/schema/mytable.ts`.
    ```typescript
    import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

    export const myTable = sqliteTable('my_table', {
        id: text().primaryKey(),
        name: text(),
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
    *   Import `MyTableOperations`.
    *   Add `public myTable: MyTableOperations;` to `DatabaseOperations` class.
    *   Initialize `this.myTable = new MyTableOperations(drizzleDb);` in the constructor.

## Type Safety

Always import types from `$lib/database` (which re-exports from `schema/index.ts`):

```typescript
import type { Client, NewClient } from '$lib/database';
```

*   **`Client`**: The shape of data read *from* the database (output).
*   **`NewClient`**: The shape of data used to *insert* into the database (input).
