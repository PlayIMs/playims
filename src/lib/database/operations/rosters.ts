// Roster operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { rosters, type Roster } from '../schema/index.js';

export class RosterOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.clientId, clientId))
			.orderBy(desc(rosters.createdAt));
	}
}
