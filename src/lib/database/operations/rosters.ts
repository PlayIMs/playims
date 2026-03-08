// Roster operations - Drizzle ORM
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { rosters, type Roster } from '../schema/index.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export class RosterOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.clientId, clientId))
			.orderBy(desc(rosters.createdAt));
	}

	async getByClientIdAndTeamIds(clientId: string, teamIds: string[]): Promise<Roster[]> {
		const uniqueTeamIds = Array.from(
			new Set(teamIds.map((teamId) => teamId.trim()).filter((teamId) => teamId.length > 0))
		);
		if (uniqueTeamIds.length === 0) {
			return [];
		}

		const results: Roster[] = [];
		for (let start = 0; start < uniqueTeamIds.length; start += IN_ARRAY_CHUNK_SIZE) {
			const chunk = uniqueTeamIds.slice(start, start + IN_ARRAY_CHUNK_SIZE);
			const chunkRows = await this.db
				.select()
				.from(rosters)
				.where(and(eq(rosters.clientId, clientId), inArray(rosters.teamId, chunk)));
			results.push(...chunkRows);
		}

		return results.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
	}

	async deleteByClientIdAndTeamId(clientId: string, teamId: string): Promise<number> {
		const result = await this.db
			.delete(rosters)
			.where(and(eq(rosters.clientId, clientId), eq(rosters.teamId, teamId)))
			.returning({ id: rosters.id });

		return result.length;
	}
}
