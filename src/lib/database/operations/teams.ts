// Team operations - Drizzle ORM
import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisions, leagues, offerings, seasons, teams, type Team } from '../schema/index.js';
import {
	buildSearchRelevanceExpression,
	buildSearchTokenClauses,
	normalizeSearchText
} from './search-helpers.js';

const IN_ARRAY_CHUNK_SIZE = 90;

export interface TeamSearchRow extends Team {
	divisionName: string | null;
	divisionSlug: string | null;
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

export class TeamOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Team[]> {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.clientId, clientId))
			.orderBy(desc(teams.createdAt));
	}

	async searchByClient(input: {
		clientId: string;
		query: string;
		seasonId?: string | null;
		seasonName?: string | null;
		limit?: number;
	}): Promise<TeamSearchRow[]> {
		const limit = Math.max(1, Math.min(input.limit ?? 40, 100));
		const searchExpressions = [
			teams.name,
			teams.slug,
			divisions.name,
			divisions.dayOfWeek,
			divisions.gameTime,
			leagues.name,
			offerings.name
		];
		const whereClauses: SQL[] = [
			eq(teams.clientId, input.clientId),
			eq(teams.isActive, 1),
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
				id: teams.id,
				clientId: teams.clientId,
				divisionId: teams.divisionId,
				name: teams.name,
				slug: teams.slug,
				description: teams.description,
				imageUrl: teams.imageUrl,
				teamStatus: teams.teamStatus,
				doesAcceptFreeAgents: teams.doesAcceptFreeAgents,
				isAutoAcceptMembers: teams.isAutoAcceptMembers,
				currentRosterSize: teams.currentRosterSize,
				teamColor: teams.teamColor,
				dateRegistered: teams.dateRegistered,
				dateJoinedDivision: teams.dateJoinedDivision,
				isActive: teams.isActive,
				createdAt: teams.createdAt,
				updatedAt: teams.updatedAt,
				createdUser: teams.createdUser,
				updatedUser: teams.updatedUser,
				divisionName: divisions.name,
				divisionSlug: divisions.slug,
				leagueName: leagues.name,
				leagueSlug: leagues.slug,
				offeringName: offerings.name,
				offeringSlug: offerings.slug,
				seasonName: seasons.name,
				seasonSlug: seasons.slug
			})
			.from(teams)
			.innerJoin(divisions, eq(teams.divisionId, divisions.id))
			.innerJoin(leagues, eq(divisions.leagueId, leagues.id))
			.leftJoin(offerings, eq(leagues.offeringId, offerings.id))
			.leftJoin(seasons, eq(leagues.seasonId, seasons.id))
			.where(and(...whereClauses))
			.orderBy(desc(relevance), asc(teams.name))
			.limit(limit);
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
		dateJoinedDivision: string | null;
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
				dateJoinedDivision: data.dateJoinedDivision,
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
			currentDivisionId?: string | null;
		},
		updatedUser?: string | null
	): Promise<Team | null> {
		const now = new Date().toISOString();
		const divisionChanged = (data.currentDivisionId?.trim() ?? '') !== data.divisionId.trim();
		const result = await this.db
			.update(teams)
			.set({
				divisionId: data.divisionId,
				teamStatus: data.teamStatus,
				dateJoinedDivision: divisionChanged ? now : undefined,
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
