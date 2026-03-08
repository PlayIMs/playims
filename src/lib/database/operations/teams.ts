// Team operations - Drizzle ORM
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { teams, type Team } from '../schema/index.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export class TeamOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Team[]> {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.clientId, clientId))
			.orderBy(desc(teams.createdAt));
	}

	async getByClientIdAndDivisionIds(clientId: string, divisionIds: string[]): Promise<Team[]> {
		const uniqueDivisionIds = Array.from(
			new Set(
				divisionIds
					.map((divisionId) => divisionId.trim())
					.filter((divisionId) => divisionId.length > 0)
			)
		);
		if (uniqueDivisionIds.length === 0) {
			return [];
		}

		const results: Team[] = [];
		for (let start = 0; start < uniqueDivisionIds.length; start += IN_ARRAY_CHUNK_SIZE) {
			const chunk = uniqueDivisionIds.slice(start, start + IN_ARRAY_CHUNK_SIZE);
			const chunkRows = await this.db
				.select()
				.from(teams)
				.where(and(eq(teams.clientId, clientId), inArray(teams.divisionId, chunk)));
			results.push(...chunkRows);
		}

		return results.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
	}

	async getByClientIdAndSlug(clientId: string, slug: string): Promise<Team | null> {
		const result = await this.db
			.select()
			.from(teams)
			.where(and(eq(teams.clientId, clientId), eq(teams.slug, slug)))
			.limit(1);

		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		divisionId: string;
		name: string;
		slug: string;
		description: string | null;
		imageUrl: string | null;
		teamStatus: string;
		doesAcceptFreeAgents: number;
		isAutoAcceptMembers: number;
		currentRosterSize: number;
		teamColor: string | null;
		dateRegistered: string | null;
		isActive: number;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<Team | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(teams)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				divisionId: data.divisionId,
				name: data.name,
				slug: data.slug,
				description: data.description,
				imageUrl: data.imageUrl,
				teamStatus: data.teamStatus,
				doesAcceptFreeAgents: data.doesAcceptFreeAgents,
				isAutoAcceptMembers: data.isAutoAcceptMembers,
				currentRosterSize: data.currentRosterSize,
				teamColor: data.teamColor,
				dateRegistered: data.dateRegistered,
				isActive: data.isActive,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}

	async updatePlacement(
		clientId: string,
		teamId: string,
		data: {
			divisionId: string;
			teamStatus: string;
		},
		updatedUser?: string | null
	): Promise<Team | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(teams)
			.set({
				divisionId: data.divisionId,
				teamStatus: data.teamStatus,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(and(eq(teams.clientId, clientId), eq(teams.id, teamId)))
			.returning();

		return result[0] ?? null;
	}

	async deleteByClientIdAndId(clientId: string, teamId: string): Promise<boolean> {
		const result = await this.db
			.delete(teams)
			.where(and(eq(teams.clientId, clientId), eq(teams.id, teamId)))
			.returning({ id: teams.id });

		return result.length > 0;
	}
}
