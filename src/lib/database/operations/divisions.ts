// Division operations - Drizzle ORM
import { asc, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisions, type Division } from '../schema/index.js';

export class DivisionOperations {
	constructor(private db: DrizzleClient) {}

	async getByLeagueIds(leagueIds: string[]): Promise<Division[]> {
		if (leagueIds.length === 0) {
			return [];
		}

		return await this.db
			.select()
			.from(divisions)
			.where(inArray(divisions.leagueId, leagueIds))
			.orderBy(asc(divisions.name));
	}
}
