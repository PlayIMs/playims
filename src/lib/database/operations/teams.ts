// Team operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { teams, type Team } from '../schema/index.js';

export class TeamOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Team[]> {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.clientId, clientId))
			.orderBy(desc(teams.createdAt));
	}
}
