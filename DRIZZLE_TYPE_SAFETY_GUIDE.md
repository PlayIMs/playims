# Drizzle ORM Type Safety Guide

## The Magic of Type Safety

Drizzle ORM provides **full TypeScript inference** - your IDE knows about every table, column, and type automatically!

---

## 1. Schema Definition = Automatic Types

When you define your schema in `src/lib/database/schema.ts`:

```typescript
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});
```

Drizzle **automatically generates** TypeScript types:

```typescript
// Automatically inferred types!
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
```

### What These Types Give You

**`Client`** - For data coming FROM the database:

```typescript
{
	id: number;
	name: string;
	email: string;
	createdAt: string;
	updatedAt: string;
}
```

**`NewClient`** - For data going TO the database:

```typescript
{
  id?: number;           // Optional (auto-generated)
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 2. Type-Safe Queries

### Example: Fetching Data

```typescript
import { DatabaseOperations } from '$lib/database/operations.js';
import type { Client } from '$lib/database/schema.js';

const dbOps = new DatabaseOperations(platform);

// ✅ TypeScript knows this returns Client[]
const clients = await dbOps.getAllClients();

// ✅ Auto-completion works!
clients.forEach((client) => {
	console.log(client.name); // ✅ TypeScript knows 'name' exists
	console.log(client.email); // ✅ TypeScript knows 'email' exists
	console.log(client.age); // ❌ TypeScript ERROR - 'age' doesn't exist!
});
```

### Example: Creating Data

```typescript
// ✅ TypeScript knows exactly what fields are required
const newClient = await dbOps.createClient({
	name: 'John Doe', // ✅ Required
	email: 'john@example.com' // ✅ Required
});

// ❌ TypeScript ERROR - missing required fields
const badClient = await dbOps.createClient({
	name: 'John Doe'
	// ❌ ERROR: 'email' is missing!
});

// ❌ TypeScript ERROR - wrong type
const wrongType = await dbOps.createClient({
	name: 'John Doe',
	email: 123 // ❌ ERROR: email must be string, not number!
});
```

### Example: Updating Data

```typescript
// ✅ TypeScript knows these fields are optional for updates
await dbOps.updateClient(1, {
	name: 'Jane Doe' // ✅ OK - only update name
});

await dbOps.updateClient(1, {
	email: 'jane@example.com' // ✅ OK - only update email
});

await dbOps.updateClient(1, {
	name: 'Jane Doe',
	email: 'jane@example.com' // ✅ OK - update both
});

// ❌ TypeScript ERROR - invalid field
await dbOps.updateClient(1, {
	age: 25 // ❌ ERROR: 'age' is not a valid field!
});
```

---

## 3. Adding a New Table (Step by Step)

Let's add a `teams` table to see type safety in action!

### Step 1: Define the Schema

Add to `src/lib/database/schema.ts`:

```typescript
export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	sport: text('sport').notNull(),
	maxPlayers: integer('max_players').notNull().default(10),
	isActive: integer('is_active').notNull().default(1), // SQLite uses 0/1 for boolean
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

// Automatically get types!
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
```

### Step 2: TypeScript Immediately Knows About It

```typescript
// TypeScript now knows:
type Team = {
	id: number;
	name: string;
	sport: string;
	maxPlayers: number;
	isActive: number;
	createdAt: string;
	updatedAt: string;
};

type NewTeam = {
	id?: number;
	name: string;
	sport: string;
	maxPlayers?: number; // Optional because of default
	isActive?: number; // Optional because of default
	createdAt: string;
	updatedAt: string;
};
```

### Step 3: Add Operations

In `src/lib/database/operations.ts`, add:

```typescript
// Team operations
async getAllTeams() {
  return await this.db
    .select()
    .from(schema.teams)
    .orderBy(desc(schema.teams.createdAt));
}

async getTeamById(id: number) {
  const result = await this.db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.id, id))
    .limit(1);

  return result[0] || null;
}

async createTeam(data: { name: string; sport: string; maxPlayers?: number }) {
  const now = new Date().toISOString();
  const result = await this.db
    .insert(schema.teams)
    .values({
      name: data.name,
      sport: data.sport,
      maxPlayers: data.maxPlayers ?? 10,
      isActive: 1,
      createdAt: now,
      updatedAt: now
    })
    .returning();

  return result[0];
}
```

### Step 4: Use It with Full Type Safety!

```typescript
const dbOps = new DatabaseOperations(platform);

// ✅ Create a team
const newTeam = await dbOps.createTeam({
	name: 'Thunder',
	sport: 'Basketball'
	// maxPlayers is optional, defaults to 10
});

// ✅ TypeScript knows the return type
console.log(newTeam.id); // ✅ number
console.log(newTeam.name); // ✅ string
console.log(newTeam.maxPlayers); // ✅ number

// ✅ Get all teams
const teams = await dbOps.getAllTeams();
teams.forEach((team) => {
	console.log(team.name); // ✅ Works!
	console.log(team.sport); // ✅ Works!
});
```

---

## 4. Advanced Type Safety Examples

### Filtering with Type Safety

```typescript
import { eq, like, and, or } from 'drizzle-orm';
import { createDrizzleClient, schema } from '$lib/database/drizzle.js';

const db = createDrizzleClient(platform);

// ✅ Search by name (type-safe)
const results = await db.select().from(schema.clients).where(like(schema.clients.name, '%John%'));
//           ^^^^^^^^^^^^^^^^^^^^ TypeScript knows this is a valid column!

// ❌ TypeScript ERROR - invalid column
const bad = await db.select().from(schema.clients).where(like(schema.clients.age, '%25%'));
//           ^^^^^^^^^^^^^^^^ ERROR: 'age' doesn't exist!
```

### Complex Queries with Type Safety

```typescript
// ✅ Multiple conditions
const activeUsers = await db
	.select()
	.from(schema.users)
	.where(and(like(schema.users.email, '%@gmail.com'), eq(schema.users.username, 'john')));

// ✅ Selecting specific columns (type-safe!)
const names = await db
	.select({
		id: schema.clients.id,
		name: schema.clients.name
	})
	.from(schema.clients);

// TypeScript knows: names is { id: number; name: string }[]
```

### Joins with Type Safety

```typescript
// ✅ Type-safe joins
const clientsWithUsers = await db
	.select({
		client: schema.clients,
		user: schema.users
	})
	.from(schema.clients)
	.leftJoin(schema.users, eq(schema.clients.email, schema.users.email));

// TypeScript knows the exact shape:
clientsWithUsers.forEach((row) => {
	console.log(row.client.name); // ✅ Works!
	console.log(row.user?.username); // ✅ Optional (left join)
});
```

---

## 5. Real-World Example: API Endpoint

Here's how type safety works in a complete API endpoint:

```typescript
// src/routes/api/teams/+server.ts
import { DatabaseOperations } from '$lib/database/operations.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { NewTeam } from '$lib/database/schema.js';

export const GET: RequestHandler = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);

	// ✅ TypeScript knows this returns Team[]
	const teams = await dbOps.getAllTeams();

	return json({
		success: true,
		data: teams,
		count: teams.length
	});
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const body = await request.json();

	// ✅ Type-safe validation
	const teamData: Pick<NewTeam, 'name' | 'sport'> = {
		name: body.name,
		sport: body.sport
	};

	// ❌ TypeScript catches missing fields
	if (!teamData.name || !teamData.sport) {
		return json({ success: false, error: 'Name and sport are required' }, { status: 400 });
	}

	const dbOps = new DatabaseOperations(platform);

	// ✅ TypeScript ensures correct data shape
	const team = await dbOps.createTeam(teamData);

	return json({ success: true, data: team }, { status: 201 });
};
```

---

## 6. Migration Workflow for New Tables

When you add a new table, follow these steps:

```bash
# 1. Edit schema.ts (add your new table)
# 2. Generate migration
pnpm run db:generate

# 3. Review the generated SQL in src/lib/database/migrations/
# 4. Apply migration
pnpm run db:migrate

# 5. Update types
wrangler types
```

---

## 7. IDE Auto-Completion Demo

In your IDE, you'll get:

```typescript
const dbOps = new DatabaseOperations(platform);

// Type "dbOps." and you'll see:
// - getAllClients()
// - getClientById(id: number)
// - createClient(data: {...})
// - updateClient(id: number, data: {...})
// - deleteClient(id: number)
// - getAllUsers()
// - getUserById(id: number)
// ... etc

// Type "client." and you'll see:
const client = await dbOps.getClientById(1);
// - client.id (number)
// - client.name (string)
// - client.email (string)
// - client.createdAt (string)
// - client.updatedAt (string)
```

---

## 8. Common Type Safety Patterns

### Pattern 1: Partial Updates

```typescript
// ✅ Update only specific fields
type ClientUpdate = Partial<Pick<Client, 'name' | 'email'>>;

const updates: ClientUpdate = {
	name: 'New Name'
	// email is optional
};

await dbOps.updateClient(1, updates);
```

### Pattern 2: Required Creation

```typescript
// ✅ Force all required fields
type CreateClient = Pick<NewClient, 'name' | 'email'>;

const newClient: CreateClient = {
	name: 'John',
	email: 'john@example.com'
	// TypeScript ensures you don't forget anything!
};
```

### Pattern 3: Type Guards

```typescript
function isValidClient(data: unknown): data is NewClient {
	return (
		typeof data === 'object' &&
		data !== null &&
		'name' in data &&
		'email' in data &&
		typeof (data as NewClient).name === 'string' &&
		typeof (data as NewClient).email === 'string'
	);
}

// Use it
const body = await request.json();
if (isValidClient(body)) {
	// ✅ TypeScript knows body is NewClient here
	await dbOps.createClient(body);
}
```

---

## 9. Benefits Summary

✅ **Catch Errors Early** - TypeScript errors at compile time, not runtime  
✅ **Auto-Completion** - IDE suggests valid columns and methods  
✅ **Refactoring Safety** - Rename a column? TypeScript finds all usages  
✅ **Documentation** - Types serve as inline documentation  
✅ **Confidence** - Know your code is correct before running it

---

## 10. Try It Yourself!

Open `src/lib/database/operations.ts` and try:

1. Type `this.db.` - see all available methods
2. Type `schema.` - see all your tables
3. Try to use an invalid column - see TypeScript error
4. Add a new method - get full type inference!

**The magic is that TypeScript knows EVERYTHING about your database from your schema definition!** 🎉
