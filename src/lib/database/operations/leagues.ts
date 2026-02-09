// League operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { leagues, type League } from '../schema/index.js';

export class LeagueOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.clientId, clientId))
			.orderBy(desc(leagues.year), desc(leagues.createdAt));
	}
}
