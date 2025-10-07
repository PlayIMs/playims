# Example: Adding a New Table with Drizzle ORM

This guide shows you **exactly** how to add a new `teams` table to your database with full type safety.

---

## Step 1: Define the Schema

Edit `src/lib/database/schema.ts` and add:

```typescript
// Add this to your existing schema file
export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	sport: text('sport').notNull(),
	maxPlayers: integer('max_players').notNull().default(10),
	captainId: integer('captain_id'), // Optional - can be null
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at').notNull(),
	updatedAt: text('updated_at').notNull()
});

// Drizzle automatically infers these types!
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
```

### What You Get Automatically

TypeScript now knows:

```typescript
type Team = {
	id: number;
	name: string;
	sport: string;
	maxPlayers: number;
	captainId: number | null; // Nullable!
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

type NewTeam = {
	id?: number; // Optional (auto-generated)
	name: string;
	sport: string;
	maxPlayers?: number; // Optional (has default)
	captainId?: number | null; // Optional
	isActive?: boolean; // Optional (has default)
	createdAt: string;
	updatedAt: string;
};
```

---

## Step 2: Generate Migration

```bash
pnpm run db:generate
```

This creates a new SQL file in `src/lib/database/migrations/` like:

```sql
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sport` text NOT NULL,
	`max_players` integer DEFAULT 10 NOT NULL,
	`captain_id` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
```

---

## Step 3: Apply Migration

```bash
pnpm run db:migrate
```

Your database now has the `teams` table!

---

## Step 4: Add Type-Safe Operations

Edit `src/lib/database/operations.ts` and add:

```typescript
// Add these methods to the DatabaseOperations class

// Get all teams
async getAllTeams(): Promise<Team[]> {
	return await this.db
		.select()
		.from(schema.teams)
		.orderBy(desc(schema.teams.createdAt));
}

// Get team by ID
async getTeamById(id: number): Promise<Team | null> {
	const result = await this.db
		.select()
		.from(schema.teams)
		.where(eq(schema.teams.id, id))
		.limit(1);

	return result[0] || null;
}

// Create team
async createTeam(data: {
	name: string;
	sport: string;
	maxPlayers?: number;
	captainId?: number;
}): Promise<Team> {
	const now = new Date().toISOString();
	const result = await this.db
		.insert(schema.teams)
		.values({
			name: data.name,
			sport: data.sport,
			maxPlayers: data.maxPlayers ?? 10,
			captainId: data.captainId ?? null,
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	return result[0];
}

// Update team
async updateTeam(
	id: number,
	data: Partial<{
		name: string;
		sport: string;
		maxPlayers: number;
		captainId: number | null;
		isActive: boolean;
	}>
): Promise<Team | null> {
	const updateData = {
		...data,
		updatedAt: new Date().toISOString()
	};

	const result = await this.db
		.update(schema.teams)
		.set(updateData)
		.where(eq(schema.teams.id, id))
		.returning();

	return result[0] || null;
}

// Delete team
async deleteTeam(id: number): Promise<boolean> {
	const result = await this.db
		.delete(schema.teams)
		.where(eq(schema.teams.id, id))
		.returning();

	return result.length > 0;
}

// Get active teams only
async getActiveTeams(): Promise<Team[]> {
	return await this.db
		.select()
		.from(schema.teams)
		.where(eq(schema.teams.isActive, true))
		.orderBy(desc(schema.teams.createdAt));
}

// Get teams by sport
async getTeamsBySport(sport: string): Promise<Team[]> {
	return await this.db
		.select()
		.from(schema.teams)
		.where(eq(schema.teams.sport, sport))
		.orderBy(asc(schema.teams.name));
}
```

Don't forget to import at the top:

```typescript
import { eq, desc, asc } from 'drizzle-orm';
import type { Team } from './schema.js';
```

---

## Step 5: Create API Endpoint

Create `src/routes/api/teams/+server.ts`:

```typescript
import { DatabaseOperations } from '$lib/database/operations.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, url }) => {
	const dbOps = new DatabaseOperations(platform);

	try {
		// Filter by sport if provided
		const sport = url.searchParams.get('sport');

		const teams = sport ? await dbOps.getTeamsBySport(sport) : await dbOps.getAllTeams();

		return json({
			success: true,
			data: teams,
			count: teams.length
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to fetch teams'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const body = await request.json();

		// ✅ Type-safe validation
		if (!body.name || !body.sport) {
			return json(
				{
					success: false,
					error: 'Name and sport are required'
				},
				{ status: 400 }
			);
		}

		const dbOps = new DatabaseOperations(platform);

		// ✅ TypeScript ensures correct data shape
		const team = await dbOps.createTeam({
			name: body.name,
			sport: body.sport,
			maxPlayers: body.maxPlayers,
			captainId: body.captainId
		});

		return json(
			{
				success: true,
				data: team
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to create team'
			},
			{ status: 500 }
		);
	}
};
```

---

## Step 6: Test It!

### Using the API

```bash
# Start dev server
pnpm run dev

# Create a team
curl -X POST http://localhost:5173/api/teams \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Thunder",
    "sport": "Basketball",
    "maxPlayers": 12
  }'

# Get all teams
curl http://localhost:5173/api/teams

# Get basketball teams only
curl http://localhost:5173/api/teams?sport=Basketball
```

### Using Drizzle Studio

```bash
pnpm run db:studio
```

Then navigate to the `teams` table and add/edit records visually!

---

## Step 7: Use in Your Pages

In any SvelteKit page:

```typescript
// src/routes/teams/+page.server.ts
import { DatabaseOperations } from '$lib/database/operations.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);

	// ✅ Type-safe!
	const teams = await dbOps.getAllTeams();

	return {
		teams
	};
};
```

```svelte
<!-- src/routes/teams/+page.svelte -->
<script lang="ts">
	import type { Team } from '$lib/database/schema.js';

	export let data: {
		teams: Team[];
	};
</script>

<h1>Teams</h1>

{#each data.teams as team}
	<div class="team-card">
		<h2>{team.name}</h2>
		<p>Sport: {team.sport}</p>
		<p>Max Players: {team.maxPlayers}</p>
		<p>Status: {team.isActive ? 'Active' : 'Inactive'}</p>
	</div>
{/each}
```

---

## The Type Safety Magic ✨

Throughout this entire process:

✅ **IDE auto-completes** all column names  
✅ **TypeScript catches** typos immediately  
✅ **Can't use** columns that don't exist  
✅ **Can't pass** wrong data types  
✅ **Refactoring is safe** - rename a column and TypeScript finds all uses

---

## Quick Reference: Common Field Types

```typescript
// Text fields
text('column_name').notNull(); // Required string
text('column_name'); // Optional string

// Numbers
integer('column_name').notNull(); // Required number
integer('column_name'); // Optional number (nullable)

// Booleans (SQLite stores as 0/1)
integer('is_active', { mode: 'boolean' }); // TypeScript sees boolean

// With defaults
integer('max_players').default(10); // Optional in NewTeam
text('status').default('pending'); // Optional in NewTeam

// Auto-increment
integer('id').primaryKey({ autoIncrement: true });

// Unique
text('email').unique();

// Timestamps
text('created_at').notNull(); // Store as ISO string
```

---

## Next Steps

Try adding more tables:

- `players` - for team members
- `games` - for match scheduling
- `leagues` - for organizing teams
- `seasons` - for time periods

Each time, you'll get **full type safety** automatically! 🎉
