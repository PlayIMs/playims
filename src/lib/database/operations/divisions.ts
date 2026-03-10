// Division operations - Drizzle ORM
import { and, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisions, type Division } from '../schema/index.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export class DivisionOperations {
	constructor(private db: DrizzleClient) {}

	async getByLeagueIds(leagueIds: string[]): Promise<Division[]> {
		const uniqueLeagueIds = Array.from(
			new Set(
				leagueIds.map((leagueId) => leagueId.trim()).filter((leagueId) => leagueId.length > 0)
			)
		);
		if (uniqueLeagueIds.length === 0) {
			return [];
		}

		const results: Division[] = [];
		for (let start = 0; start < uniqueLeagueIds.length; start += IN_ARRAY_CHUNK_SIZE) {
			const chunk = uniqueLeagueIds.slice(start, start + IN_ARRAY_CHUNK_SIZE);
			const chunkRows = await this.db
				.select()
				.from(divisions)
				.where(inArray(divisions.leagueId, chunk));
			results.push(...chunkRows);
		}

		return results.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
	}

	async getByLeagueId(leagueId: string): Promise<Division[]> {
		const normalizedLeagueId = leagueId.trim();
		if (!normalizedLeagueId) {
			return [];
		}

		const result = await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.leagueId, normalizedLeagueId));
		return result.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
	}

	async getByLeagueIdAndSlug(leagueId: string, slug: string): Promise<Division | null> {
		const normalizedLeagueId = leagueId.trim();
		const normalizedSlug = slug.trim();
		if (!normalizedLeagueId || !normalizedSlug) {
			return null;
		}

		const result = await this.db
			.select()
			.from(divisions)
			.where(and(eq(divisions.leagueId, normalizedLeagueId), eq(divisions.slug, normalizedSlug)))
			.limit(1);
		return result[0] ?? null;
	}

	async getById(divisionId: string): Promise<Division | null> {
		const result = await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.id, divisionId))
			.limit(1);
		return result[0] ?? null;
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

	async updateTeamsCount(
		divisionId: string,
		teamsCount: number,
		updatedUser?: string | null
	): Promise<Division | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(divisions)
			.set({
				teamsCount,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(eq(divisions.id, divisionId))
			.returning();

		return result[0] ?? null;
	}

	async update(
		divisionId: string,
		data: {
			name: string;
			slug: string;
			description: string | null;
			dayOfWeek: string | null;
			gameTime: string | null;
			maxTeams: number | null;
			location: string | null;
			isLocked: number;
			startDate: string | null;
			updatedUser?: string | null;
		}
	): Promise<Division | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(divisions)
			.set({
				name: data.name,
				slug: data.slug,
				description: data.description,
				dayOfWeek: data.dayOfWeek,
				gameTime: data.gameTime,
				maxTeams: data.maxTeams,
				location: data.location,
				isLocked: data.isLocked,
				startDate: data.startDate,
				updatedAt: now,
				updatedUser: data.updatedUser ?? null
			})
			.where(eq(divisions.id, divisionId))
			.returning();

		return result[0] ?? null;
	}

	async existsByLeagueIdAndSlug(leagueId: string, slug: string): Promise<boolean> {
		const result = await this.db
			.select({ id: divisions.id })
			.from(divisions)
			.where(and(eq(divisions.leagueId, leagueId), eq(divisions.slug, slug)))
			.limit(1);

		return result.length > 0;
	}
}
