import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubTeamRosters, type ClubTeamRoster } from '../schema/index.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export class ClubTeamRosterOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientIdAndTeamIds(clientId: string, teamIds: string[]): Promise<ClubTeamRoster[]> {
		const uniqueTeamIds = Array.from(new Set(teamIds.filter(Boolean)));
		if (uniqueTeamIds.length === 0) return [];

		const results: ClubTeamRoster[] = [];
		for (let start = 0; start < uniqueTeamIds.length; start += IN_ARRAY_CHUNK_SIZE) {
			const chunk = uniqueTeamIds.slice(start, start + IN_ARRAY_CHUNK_SIZE);
			const rows = await this.db
				.select()
				.from(clubTeamRosters)
				.where(and(eq(clubTeamRosters.clientId, clientId), inArray(clubTeamRosters.clubTeamId, chunk)));
			results.push(...rows);
		}

		return results;
	}
}
