// Division standings operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisionStandings, type DivisionStanding } from '../schema/index.js';

export class DivisionStandingOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<DivisionStanding[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(divisionStandings)
				.where(eq(divisionStandings.clientId, clientId))
				.orderBy(desc(divisionStandings.createdAt));
		}

		return await this.db.select().from(divisionStandings).orderBy(desc(divisionStandings.createdAt));
	}

	async getById(id: string): Promise<DivisionStanding | null> {
		const result = await this.db.select().from(divisionStandings).where(eq(divisionStandings.id, id));
		return result[0] || null;
	}

	async getByDivisionId(divisionId: string): Promise<DivisionStanding[]> {
		return await this.db
			.select()
			.from(divisionStandings)
			.where(eq(divisionStandings.divisionId, divisionId))
			.orderBy(desc(divisionStandings.points), desc(divisionStandings.lastUpdatedAt));
	}

	async getByTeamId(teamId: string): Promise<DivisionStanding[]> {
		return await this.db
			.select()
			.from(divisionStandings)
			.where(eq(divisionStandings.teamId, teamId))
			.orderBy(desc(divisionStandings.lastUpdatedAt));
	}

	async create(data: {
		clientId?: string;
		leagueId?: string;
		divisionId?: string;
		teamId?: string;
		wins?: number;
		losses?: number;
		ties?: number;
		pointsFor?: number;
		pointsAgainst?: number;
		points?: number;
		winPct?: string;
		streak?: string;
		lastUpdatedAt?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<DivisionStanding | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(divisionStandings)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				leagueId: data.leagueId || null,
				divisionId: data.divisionId || null,
				teamId: data.teamId || null,
				wins: data.wins ?? 0,
				losses: data.losses ?? 0,
				ties: data.ties ?? 0,
				pointsFor: data.pointsFor ?? 0,
				pointsAgainst: data.pointsAgainst ?? 0,
				points: data.points ?? 0,
				winPct: data.winPct || null,
				streak: data.streak || null,
				lastUpdatedAt: data.lastUpdatedAt || now,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser || null,
				updatedUser: data.updatedUser || data.createdUser || null
			})
			.returning();

		return result[0] || null;
	}

	async update(
		id: string,
		data: Partial<{
			wins: number;
			losses: number;
			ties: number;
			pointsFor: number;
			pointsAgainst: number;
			points: number;
			winPct: string;
			streak: string;
			lastUpdatedAt: string;
			updatedUser: string;
		}>
	): Promise<DivisionStanding | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(divisionStandings)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(divisionStandings.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(divisionStandings).where(eq(divisionStandings.id, id)).returning();
		return result.length > 0;
	}
}
