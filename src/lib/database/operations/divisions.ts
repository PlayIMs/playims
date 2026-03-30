// Division operations - Drizzle ORM
import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisions, leagues, offerings, seasons, type Division } from '../schema/index.js';
import {
	buildSearchRelevanceExpression,
	buildSearchTokenClauses,
	normalizeSearchText
} from './search-helpers.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export interface DivisionSearchRow extends Division {
	leagueName: string | null;
	leagueSlug: string | null;
	offeringName: string | null;
	offeringSlug: string | null;
	seasonName: string | null;
	seasonSlug: string | null;
}

const buildLegacySeasonLabelExpression = (): SQL =>
	sql`trim(
		coalesce(${leagues.season}, '') ||
		case
			when ${leagues.season} is not null and trim(${leagues.season}) <> '' and ${leagues.year} is not null
				then ' '
			else ''
		end ||
		coalesce(cast(${leagues.year} as text), '')
	)`;

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

	async searchByClient(input: {
		clientId: string;
		query: string;
		seasonId?: string | null;
		seasonName?: string | null;
		limit?: number;
	}): Promise<DivisionSearchRow[]> {
		const limit = Math.max(1, Math.min(input.limit ?? 40, 100));
		const searchExpressions = [
			divisions.name,
			divisions.slug,
			divisions.dayOfWeek,
			divisions.gameTime,
			divisions.location,
			leagues.name,
			offerings.name
		];
		const whereClauses: SQL[] = [
			eq(leagues.clientId, input.clientId),
			eq(divisions.isActive, 1),
			eq(sql`coalesce(${leagues.isActive}, 1)`, 1),
			...buildSearchTokenClauses(input.query, searchExpressions)
		];

		if (input.seasonId && input.seasonName) {
			whereClauses.push(
				or(
					eq(leagues.seasonId, input.seasonId),
					and(
						sql`${leagues.seasonId} is null or trim(${leagues.seasonId}) = ''`,
						sql`lower(${buildLegacySeasonLabelExpression()}) = ${normalizeSearchText(input.seasonName)}`
					)
				) as SQL
			);
		}

		const relevance = buildSearchRelevanceExpression(input.query, searchExpressions);
		return await this.db
			.select({
				id: divisions.id,
				leagueId: divisions.leagueId,
				name: divisions.name,
				slug: divisions.slug,
				description: divisions.description,
				dayOfWeek: divisions.dayOfWeek,
				gameTime: divisions.gameTime,
				maxTeams: divisions.maxTeams,
				location: divisions.location,
				isActive: divisions.isActive,
				isLocked: divisions.isLocked,
				doAutoLock: divisions.doAutoLock,
				teamsCount: divisions.teamsCount,
				startDate: divisions.startDate,
				createdAt: divisions.createdAt,
				updatedAt: divisions.updatedAt,
				createdUser: divisions.createdUser,
				updatedUser: divisions.updatedUser,
				leagueName: leagues.name,
				leagueSlug: leagues.slug,
				offeringName: offerings.name,
				offeringSlug: offerings.slug,
				seasonName: seasons.name,
				seasonSlug: seasons.slug
			})
			.from(divisions)
			.innerJoin(leagues, eq(divisions.leagueId, leagues.id))
			.leftJoin(offerings, eq(leagues.offeringId, offerings.id))
			.leftJoin(seasons, eq(leagues.seasonId, seasons.id))
			.where(and(...whereClauses))
			.orderBy(desc(relevance), asc(divisions.name))
			.limit(limit);
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
		doAutoLock: number;
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
				doAutoLock: data.doAutoLock,
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

	async syncCapacityState(
		divisionId: string,
		teamsCount: number,
		isLocked: number,
		doAutoLock: number,
		updatedUser?: string | null
	): Promise<Division | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(divisions)
			.set({
				teamsCount,
				isLocked,
				doAutoLock,
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
			doAutoLock: number;
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
				doAutoLock: data.doAutoLock,
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
