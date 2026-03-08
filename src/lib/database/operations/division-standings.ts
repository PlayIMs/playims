// Division standings operations - Drizzle ORM
import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisionStandings, type DivisionStanding } from '../schema/index.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export class DivisionStandingsOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientIdAndLeagueId(clientId: string, leagueId: string): Promise<DivisionStanding[]> {
		return await this.db
			.select()
			.from(divisionStandings)
			.where(
				and(eq(divisionStandings.clientId, clientId), eq(divisionStandings.leagueId, leagueId))
			);
	}

	async deleteByClientIdAndTeamId(clientId: string, teamId: string): Promise<number> {
		const result = await this.db
			.delete(divisionStandings)
			.where(and(eq(divisionStandings.clientId, clientId), eq(divisionStandings.teamId, teamId)))
			.returning({ id: divisionStandings.id });

		return result.length;
	}

	async deleteByClientIdAndTeamIds(clientId: string, teamIds: string[]): Promise<number> {
		const uniqueTeamIds = Array.from(
			new Set(teamIds.map((teamId) => teamId.trim()).filter((teamId) => teamId.length > 0))
		);
		if (uniqueTeamIds.length === 0) {
			return 0;
		}

		let deletedCount = 0;
		for (let start = 0; start < uniqueTeamIds.length; start += IN_ARRAY_CHUNK_SIZE) {
			const chunk = uniqueTeamIds.slice(start, start + IN_ARRAY_CHUNK_SIZE);
			const result = await this.db
				.delete(divisionStandings)
				.where(
					and(eq(divisionStandings.clientId, clientId), inArray(divisionStandings.teamId, chunk))
				)
				.returning({ id: divisionStandings.id });
			deletedCount += result.length;
		}

		return deletedCount;
	}
}
