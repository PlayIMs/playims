// League operations - Drizzle ORM
import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { leagues, offerings, seasons, type League } from '../schema/index.js';
import {
	buildSearchRelevanceExpression,
	buildSearchTokenClauses,
	normalizeSearchText
} from './search-helpers.js';

export interface LeagueSearchRow extends League {
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

export class LeagueOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.clientId, clientId))
			.orderBy(desc(leagues.year), asc(leagues.stackOrder), desc(leagues.createdAt));
	}

	async searchByClient(input: {
		clientId: string;
		query: string;
		seasonId?: string | null;
		seasonName?: string | null;
		limit?: number;
	}): Promise<LeagueSearchRow[]> {
		const limit = Math.max(1, Math.min(input.limit ?? 40, 100));
		const searchExpressions = [
			leagues.name,
			leagues.slug,
			leagues.season,
			sql`cast(${leagues.year} as text)`,
			offerings.name,
			offerings.slug,
			offerings.sport
		];
		const whereClauses: SQL[] = [
			eq(leagues.clientId, input.clientId),
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
				id: leagues.id,
				clientId: leagues.clientId,
				offeringId: leagues.offeringId,
				seasonId: leagues.seasonId,
				name: leagues.name,
				slug: leagues.slug,
				stackOrder: leagues.stackOrder,
				description: leagues.description,
				year: leagues.year,
				season: leagues.season,
				gender: leagues.gender,
				skillLevel: leagues.skillLevel,
				regStartDate: leagues.regStartDate,
				regEndDate: leagues.regEndDate,
				seasonStartDate: leagues.seasonStartDate,
				seasonEndDate: leagues.seasonEndDate,
				hasPostseason: leagues.hasPostseason,
				postseasonStartDate: leagues.postseasonStartDate,
				postseasonEndDate: leagues.postseasonEndDate,
				hasPreseason: leagues.hasPreseason,
				preseasonStartDate: leagues.preseasonStartDate,
				preseasonEndDate: leagues.preseasonEndDate,
				isActive: leagues.isActive,
				isLocked: leagues.isLocked,
				imageUrl: leagues.imageUrl,
				createdAt: leagues.createdAt,
				updatedAt: leagues.updatedAt,
				createdUser: leagues.createdUser,
				updatedUser: leagues.updatedUser,
				offeringName: offerings.name,
				offeringSlug: offerings.slug,
				seasonName: seasons.name,
				seasonSlug: seasons.slug
			})
			.from(leagues)
			.leftJoin(offerings, eq(leagues.offeringId, offerings.id))
			.leftJoin(seasons, eq(leagues.seasonId, seasons.id))
			.where(and(...whereClauses))
			.orderBy(desc(relevance), asc(leagues.name))
			.limit(limit);
	}

	async getByClientIdAndSlug(clientId: string, slug: string): Promise<League | null> {
		const result = await this.db
			.select()
			.from(leagues)
			.where(and(eq(leagues.clientId, clientId), eq(leagues.slug, slug)))
			.limit(1);

		return result[0] ?? null;
	}

	async getByOfferingId(offeringId: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.offeringId, offeringId))
			.orderBy(asc(leagues.stackOrder), asc(leagues.name));
	}

	async getByOfferingIdAndSlug(offeringId: string, slug: string): Promise<League | null> {
		const result = await this.db
			.select()
			.from(leagues)
			.where(and(eq(leagues.offeringId, offeringId), eq(leagues.slug, slug)))
			.limit(1);

		return result[0] ?? null;
	}

	async getByClientIdAndId(clientId: string, leagueId: string): Promise<League | null> {
		const result = await this.db
			.select()
			.from(leagues)
			.where(and(eq(leagues.clientId, clientId), eq(leagues.id, leagueId)))
			.limit(1);

		return result[0] ?? null;
	}

	async getByClientIdSeasonIdAndSlug(
		clientId: string,
		seasonId: string,
		slug: string
	): Promise<League | null> {
		const result = await this.db
			.select()
			.from(leagues)
			.where(
				and(eq(leagues.clientId, clientId), eq(leagues.seasonId, seasonId), eq(leagues.slug, slug))
			)
			.limit(1);

		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		offeringId: string;
		seasonId: string;
		name: string;
		slug: string;
		stackOrder: number;
		description: string | null;
		year?: number | null;
		season?: string | null;
		gender: 'male' | 'female' | 'mixed' | null;
		skillLevel: 'competitive' | 'intermediate' | 'recreational' | 'all' | null;
		regStartDate: string;
		regEndDate: string;
		seasonStartDate: string;
		seasonEndDate: string;
		hasPostseason: number;
		postseasonStartDate: string | null;
		postseasonEndDate: string | null;
		hasPreseason: number;
		preseasonStartDate: string | null;
		preseasonEndDate: string | null;
		isActive: number;
		isLocked: number;
		imageUrl: string | null;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<League | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(leagues)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				offeringId: data.offeringId,
				seasonId: data.seasonId,
				name: data.name,
				slug: data.slug,
				stackOrder: data.stackOrder,
				description: data.description,
				year: data.year ?? null,
				season: data.season ?? null,
				gender: data.gender,
				skillLevel: data.skillLevel,
				regStartDate: data.regStartDate,
				regEndDate: data.regEndDate,
				seasonStartDate: data.seasonStartDate,
				seasonEndDate: data.seasonEndDate,
				hasPostseason: data.hasPostseason,
				postseasonStartDate: data.postseasonStartDate,
				postseasonEndDate: data.postseasonEndDate,
				hasPreseason: data.hasPreseason,
				preseasonStartDate: data.preseasonStartDate,
				preseasonEndDate: data.preseasonEndDate,
				isActive: data.isActive,
				isLocked: data.isLocked,
				imageUrl: data.imageUrl,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}

	async updateByClientIdAndId(
		clientId: string,
		leagueId: string,
		data: {
			offeringId: string;
			seasonId: string;
			name: string;
			slug: string;
			stackOrder: number;
			description: string | null;
			year?: number | null;
			season?: string | null;
			gender: 'male' | 'female' | 'mixed' | null;
			skillLevel: 'competitive' | 'intermediate' | 'recreational' | 'all' | null;
			regStartDate: string;
			regEndDate: string;
			seasonStartDate: string;
			seasonEndDate: string;
			hasPostseason: number;
			postseasonStartDate: string | null;
			postseasonEndDate: string | null;
			hasPreseason: number;
			preseasonStartDate: string | null;
			preseasonEndDate: string | null;
			isActive: number;
			isLocked: number;
			imageUrl: string | null;
			updatedUser?: string | null;
		}
	): Promise<League | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(leagues)
			.set({
				offeringId: data.offeringId,
				seasonId: data.seasonId,
				name: data.name,
				slug: data.slug,
				stackOrder: data.stackOrder,
				description: data.description,
				year: data.year ?? null,
				season: data.season ?? null,
				gender: data.gender,
				skillLevel: data.skillLevel,
				regStartDate: data.regStartDate,
				regEndDate: data.regEndDate,
				seasonStartDate: data.seasonStartDate,
				seasonEndDate: data.seasonEndDate,
				hasPostseason: data.hasPostseason,
				postseasonStartDate: data.postseasonStartDate,
				postseasonEndDate: data.postseasonEndDate,
				hasPreseason: data.hasPreseason,
				preseasonStartDate: data.preseasonStartDate,
				preseasonEndDate: data.preseasonEndDate,
				isActive: data.isActive,
				isLocked: data.isLocked,
				imageUrl: data.imageUrl,
				updatedAt: now,
				updatedUser: data.updatedUser ?? null
			})
			.where(and(eq(leagues.clientId, clientId), eq(leagues.id, leagueId)))
			.returning();

		return result[0] ?? null;
	}

	async deleteByOfferingId(offeringId: string): Promise<number> {
		const result = await this.db
			.delete(leagues)
			.where(eq(leagues.offeringId, offeringId))
			.returning({ id: leagues.id });
		return result.length;
	}
}
