// @deprecated This file is kept for backward compatibility
// Use the new modular structure: import { DatabaseOperations } from './operations/index.js'
//
// New structure:
// - src/lib/database/operations/clients.ts
// - src/lib/database/operations/users.ts
// - src/lib/database/operations/sports.ts
// - src/lib/database/operations/leagues.ts
// - src/lib/database/operations/divisions.ts
// - src/lib/database/operations/teams.ts
// - src/lib/database/operations/rosters.ts

export { DatabaseOperations } from './operations/index.js';
export type {
	ClientOperations,
	UserOperations,
	SportOperations,
	LeagueOperations,
	DivisionOperations,
	TeamOperations,
	RosterOperations
} from './operations/index.js';
