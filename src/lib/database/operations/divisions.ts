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

	async create(data: {
		leagueId: string;
		name: string;
		slug: string;
		description: string | null;
		dayOfWeek: string | null;
		gameTime: string | null;
		maxTeams: number | null;
		location: string | null;
		isActive: number;
		isLocked: number;
		teamsCount: number | null;
		startDate: string | null;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<Division | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(divisions)
			.values({
				id: crypto.randomUUID(),
				leagueId: data.leagueId,
				name: data.name,
				slug: data.slug,
				description: data.description,
				dayOfWeek: data.dayOfWeek,
				gameTime: data.gameTime,
				maxTeams: data.maxTeams,
				location: data.location,
				isActive: data.isActive,
				isLocked: data.isLocked,
				teamsCount: data.teamsCount,
				startDate: data.startDate,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}
}
