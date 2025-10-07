# Database Operations - Modular Structure ✅

## New Encapsulated Design

Your database operations are now organized in a **clean, modular structure** where each table has its own dedicated file. This ensures files stay manageable and easy to maintain.

---

## File Structure

```
src/lib/database/operations/
├── index.ts           # Main entry point (exports DatabaseOperations)
├── clients.ts         # Client-specific operations
├── users.ts           # User-specific operations
├── sports.ts          # Sport-specific operations
├── leagues.ts         # League-specific operations
├── divisions.ts       # Division-specific operations
├── teams.ts           # Team-specific operations
└── rosters.ts         # Roster-specific operations
```

---

## How to Use

### Option 1: Unified Access (Recommended)

Use the `DatabaseOperations` class to access all operations:

```typescript
import { DatabaseOperations } from '$lib/database/operations/index.js';

const dbOps = new DatabaseOperations(platform);

// Access any table's operations
const clients = await dbOps.clients.getAll();
const users = await dbOps.users.getByClientId('client-123');
const teams = await dbOps.teams.getByDivisionId(1);
const rosters = await dbOps.rosters.getByTeamId(5);
```

### Option 2: Direct Import (For Specific Use Cases)

Import only the operations you need:

```typescript
import { ClientOperations } from '$lib/database/operations/clients.js';
import { TeamOperations } from '$lib/database/operations/teams.js';
import { createDrizzleClient } from '$lib/database/drizzle.js';

const db = createDrizzleClient(platform);
const clientOps = new ClientOperations(db);
const teamOps = new TeamOperations(db);

const clients = await clientOps.getAll();
const teams = await teamOps.getByClientId(123);
```

---

## Available Operations by Table

### Clients Operations (`clients.ts`)

```typescript
const dbOps = new DatabaseOperations(platform);

await dbOps.clients.getAll();
await dbOps.clients.getById(id);
await dbOps.clients.getBySlug(slug);
await dbOps.clients.getActive();
await dbOps.clients.create({ name, slug, metadata });
await dbOps.clients.update(id, { name, slug, status });
await dbOps.clients.delete(id);
```

### Users Operations (`users.ts`)

```typescript
await dbOps.users.getAll();
await dbOps.users.getById(id);
await dbOps.users.getByEmail(email);
await dbOps.users.getByClientId(clientId);
await dbOps.users.create({ clientId, email, firstName, lastName });
await dbOps.users.update(id, { firstName, lastName, role });
await dbOps.users.delete(id);
await dbOps.users.updateLastLogin(id);
await dbOps.users.search(searchTerm);
```

### Sports Operations (`sports.ts`)

```typescript
await dbOps.sports.getAll();
await dbOps.sports.getById(id);
await dbOps.sports.getBySlug(slug);
await dbOps.sports.getActive();
await dbOps.sports.getByClientId(clientId);
await dbOps.sports.create({ name, slug, type, minPlayers, maxPlayers });
await dbOps.sports.update(id, { name, description, isActive });
await dbOps.sports.delete(id);
await dbOps.sports.toggleActive(id);
```

### Leagues Operations (`leagues.ts`)

```typescript
await dbOps.leagues.getAll();
await dbOps.leagues.getById(id);
await dbOps.leagues.getBySlug(slug);
await dbOps.leagues.getByClientId(clientId);
await dbOps.leagues.getBySportId(sportId);
await dbOps.leagues.getActive();
await dbOps.leagues.getByYearAndSeason(year, season);
await dbOps.leagues.create({ clientId, sportId, name, slug, year, season });
await dbOps.leagues.update(id, { name, description, isActive });
await dbOps.leagues.delete(id);
await dbOps.leagues.toggleActive(id);
await dbOps.leagues.lock(id);
await dbOps.leagues.unlock(id);
```

### Divisions Operations (`divisions.ts`)

```typescript
await dbOps.divisions.getAll();
await dbOps.divisions.getById(id);
await dbOps.divisions.getBySlug(slug);
await dbOps.divisions.getByLeagueId(leagueId);
await dbOps.divisions.getActive();
await dbOps.divisions.getByDayOfWeek(dayOfWeek);
await dbOps.divisions.create({ leagueId, name, slug, dayOfWeek, gameTime });
await dbOps.divisions.update(id, { name, maxTeams, location });
await dbOps.divisions.delete(id);
await dbOps.divisions.incrementTeamCount(id);
await dbOps.divisions.decrementTeamCount(id);
```

### Teams Operations (`teams.ts`)

```typescript
await dbOps.teams.getAll();
await dbOps.teams.getById(id);
await dbOps.teams.getBySlug(slug);
await dbOps.teams.getByClientId(clientId);
await dbOps.teams.getByDivisionId(divisionId);
await dbOps.teams.getByStatus(status);
await dbOps.teams.getAcceptingFreeAgents();
await dbOps.teams.create({ clientId, divisionId, name, slug });
await dbOps.teams.update(id, { name, description, teamStatus });
await dbOps.teams.delete(id);
await dbOps.teams.updateRosterSize(id, size);
await dbOps.teams.incrementRosterSize(id);
await dbOps.teams.decrementRosterSize(id);
await dbOps.teams.toggleFreeAgents(id);
```

### Rosters Operations (`rosters.ts`)

```typescript
await dbOps.rosters.getAll();
await dbOps.rosters.getById(id);
await dbOps.rosters.getByTeamId(teamId);
await dbOps.rosters.getByUserId(userId);
await dbOps.rosters.getByClientId(clientId);
await dbOps.rosters.getByStatus(status);
await dbOps.rosters.getTeamCaptain(teamId);
await dbOps.rosters.create({ clientId, teamId, userId, rosterStatus });
await dbOps.rosters.update(id, { rosterStatus, isCaptain });
await dbOps.rosters.delete(id);
await dbOps.rosters.setCaptain(id);
await dbOps.rosters.removeCaptain(id);
await dbOps.rosters.setCoCaptain(id);
await dbOps.rosters.checkExists(userId, teamId);
```

---

## Usage Examples

### Example 1: Page Load Function

```typescript
// src/routes/leagues/+page.server.ts
import { DatabaseOperations } from '$lib/database/operations/index.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const dbOps = new DatabaseOperations(platform);

	// Get all active leagues
	const leagues = await dbOps.leagues.getActive();

	// Get sports for filter dropdown
	const sports = await dbOps.sports.getActive();

	return {
		leagues,
		sports
	};
};
```

### Example 2: API Endpoint

```typescript
// src/routes/api/teams/+server.ts
import { DatabaseOperations } from '$lib/database/operations/index.js';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, url }) => {
	const dbOps = new DatabaseOperations(platform);

	const divisionId = url.searchParams.get('divisionId');

	const teams = divisionId
		? await dbOps.teams.getByDivisionId(parseInt(divisionId))
		: await dbOps.teams.getAll();

	return json({
		success: true,
		data: teams,
		count: teams.length
	});
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const dbOps = new DatabaseOperations(platform);
	const data = await request.json();

	// Validation
	if (!data.clientId || !data.divisionId || !data.name || !data.slug) {
		return json({ success: false, error: 'Missing required fields' }, { status: 400 });
	}

	const team = await dbOps.teams.create({
		clientId: data.clientId,
		divisionId: data.divisionId,
		name: data.name,
		slug: data.slug,
		description: data.description
	});

	// Increment division team count
	await dbOps.divisions.incrementTeamCount(data.divisionId);

	return json({ success: true, data: team }, { status: 201 });
};
```

### Example 3: Complex Business Logic

```typescript
// src/routes/teams/[id]/join/+server.ts
import { DatabaseOperations } from '$lib/database/operations/index.js';
import { json } from '@sveltejs/kit';

export const POST = async ({ params, request, platform }) => {
	const dbOps = new DatabaseOperations(platform);
	const { userId } = await request.json();
	const teamId = parseInt(params.id);

	// Check if user already on this team
	const existing = await dbOps.rosters.checkExists(userId, teamId);
	if (existing) {
		return json({ success: false, error: 'User already on team' }, { status: 400 });
	}

	// Get team info
	const team = await dbOps.teams.getById(teamId);
	if (!team) {
		return json({ success: false, error: 'Team not found' }, { status: 404 });
	}

	// Add to roster
	const roster = await dbOps.rosters.create({
		clientId: team.clientId,
		teamId: teamId,
		userId: userId,
		rosterStatus: 'active'
	});

	// Update team roster size
	await dbOps.teams.incrementRosterSize(teamId);

	return json({ success: true, data: roster }, { status: 201 });
};
```

---

## Benefits of This Structure

✅ **Organized** - Each table has its own file  
✅ **Maintainable** - Files stay small and focused  
✅ **Scalable** - Easy to add new operations to specific tables  
✅ **Type-safe** - Full TypeScript inference throughout  
✅ **Reusable** - Import only what you need  
✅ **Clear** - Easy to find operations for a specific table

---

## Migration from Old Structure

### Old Way (Single File)

```typescript
// Everything in one file - gets too long!
export class DatabaseOperations {
	async getAllClients() {
		/* ... */
	}
	async getAllUsers() {
		/* ... */
	}
	async getAllTeams() {
		/* ... */
	}
	// ... 100+ methods in one file!
}
```

### New Way (Modular)

```typescript
// Organized by table
import { ClientOperations } from './operations/clients.js';
import { UserOperations } from './operations/users.js';
// Each file is focused and manageable
```

### Backward Compatible

The old import still works!

```typescript
// This still works (for backward compatibility)
import { DatabaseOperations } from '$lib/database/operations.js';

const dbOps = new DatabaseOperations(platform);
await dbOps.clients.getAll(); // ✅ Works!
```

---

## Adding New Operations

### To Add a New Method to Clients

1. Open `src/lib/database/operations/clients.ts`
2. Add your method:

```typescript
async getByStatus(status: string) {
  return await this.db
    .select()
    .from(clients)
    .where(eq(clients.status, status))
    .orderBy(desc(clients.createdAt));
}
```

3. Use it:

```typescript
const activeClients = await dbOps.clients.getByStatus('active');
```

**That's it!** No need to modify other files.

---

## File Size Comparison

### Before (Single File)

```
operations.ts - 500+ lines (would grow to thousands)
```

### After (Modular)

```
operations/index.ts    - ~50 lines  (just exports)
operations/clients.ts  - ~70 lines  (focused)
operations/users.ts    - ~100 lines (focused)
operations/sports.ts   - ~100 lines (focused)
operations/leagues.ts  - ~150 lines (focused)
operations/divisions.ts- ~130 lines (focused)
operations/teams.ts    - ~150 lines (focused)
operations/rosters.ts  - ~120 lines (focused)
```

**Result:** Each file is ~100-150 lines max, easy to navigate!

---

## TypeScript Benefits

Each operation file has full type safety:

```typescript
// In clients.ts
async create(data: { name: string; slug: string; metadata?: string }) {
  // TypeScript knows exactly what's required!
}

// In teams.ts
async incrementRosterSize(id: number) {
  // TypeScript knows id must be number (not string)
}
```

---

## Quick Reference

| Table         | File           | Common Methods                                      |
| ------------- | -------------- | --------------------------------------------------- |
| **Clients**   | `clients.ts`   | getAll, getById, getBySlug, getActive               |
| **Users**     | `users.ts`     | getAll, getByEmail, getByClientId, search           |
| **Sports**    | `sports.ts`    | getAll, getActive, toggleActive                     |
| **Leagues**   | `leagues.ts`   | getByYearAndSeason, lock, unlock                    |
| **Divisions** | `divisions.ts` | getByLeagueId, incrementTeamCount                   |
| **Teams**     | `teams.ts`     | getByDivisionId, updateRosterSize, toggleFreeAgents |
| **Rosters**   | `rosters.ts`   | getByTeamId, setCaptain, checkExists                |

---

## Summary

✅ **Created 7 operation files** - One per table  
✅ **Created index.ts** - Unified access point  
✅ **Backward compatible** - Old imports still work  
✅ **Type-safe** - Full TypeScript inference  
✅ **Maintainable** - Files stay manageable  
✅ **Scalable** - Easy to add new operations

Your database layer is now **professionally organized**! 🎉
