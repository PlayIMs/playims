// Offering operations - Drizzle ORM
import { and, asc, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { offerings, seasons, type Offering } from '../schema/index.js';
import { buildOfferingSeriesBackfillPlan } from '$lib/utils/offering-linking.js';
import { buildSearchRelevanceExpression, buildSearchTokenClauses } from './search-helpers.js';

export interface OfferingSearchRow extends Offering {
	seasonName: string | null;
	seasonSlug: string | null;
}

export class OfferingOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Offering[]> {
		return await this.db
			.select()
			.from(offerings)
			.where(eq(offerings.clientId, clientId))
			.orderBy(asc(offerings.name));
	}

	async searchByClient(input: {
		clientId: string;
		query: string;
		seasonId?: string | null;
		limit?: number;
	}): Promise<OfferingSearchRow[]> {
		const limit = Math.max(1, Math.min(input.limit ?? 40, 100));
		const searchExpressions = [
			offerings.name,
			offerings.slug,
			offerings.sport,
			offerings.description
		];
		const whereClauses = [
			eq(offerings.clientId, input.clientId),
			eq(offerings.isActive, 1),
			...buildSearchTokenClauses(input.query, searchExpressions)
		];

		if (input.seasonId) {
			whereClauses.push(eq(offerings.seasonId, input.seasonId));
		}

		const relevance = buildSearchRelevanceExpression(input.query, searchExpressions);
		return await this.db
			.select({
				id: offerings.id,
				name: offerings.name,
				slug: offerings.slug,
				isActive: offerings.isActive,
				imageUrl: offerings.imageUrl,
				minPlayers: offerings.minPlayers,
				maxPlayers: offerings.maxPlayers,
				rulebookUrl: offerings.rulebookUrl,
				sport: offerings.sport,
				type: offerings.type,
				description: offerings.description,
				clientId: offerings.clientId,
				seasonId: offerings.seasonId,
				seriesId: offerings.seriesId,
				createdAt: offerings.createdAt,
				updatedAt: offerings.updatedAt,
				createdUser: offerings.createdUser,
				updatedUser: offerings.updatedUser,
				seasonName: seasons.name,
				seasonSlug: seasons.slug
			})
			.from(offerings)
			.leftJoin(seasons, eq(offerings.seasonId, seasons.id))
			.where(and(...whereClauses))
			.orderBy(desc(relevance), asc(offerings.name))
			.limit(limit);
	}

	async getByClientIdAndSlug(
		clientId: string,
		slug: string,
		seasonId?: string | null
	): Promise<Offering | null> {
		const result = await this.db
			.select()
			.from(offerings)
			.where(
				seasonId
					? and(
							eq(offerings.clientId, clientId),
							eq(offerings.slug, slug),
							eq(offerings.seasonId, seasonId)
						)
					: and(eq(offerings.clientId, clientId), eq(offerings.slug, slug))
			)
			.limit(1);

		return result[0] ?? null;
	}

	async getByClientIdAndId(clientId: string, offeringId: string): Promise<Offering | null> {
		const result = await this.db
			.select()
			.from(offerings)
			.where(and(eq(offerings.clientId, clientId), eq(offerings.id, offeringId)))
			.limit(1);
		return result[0] ?? null;
	}

	async getByClientIdSeasonIdAndSlug(
		clientId: string,
		seasonId: string,
		slug: string
	): Promise<Offering | null> {
		const result = await this.db
			.select()
			.from(offerings)
			.where(
				and(
					eq(offerings.clientId, clientId),
					eq(offerings.seasonId, seasonId),
					eq(offerings.slug, slug)
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		seasonId: string;
		name: string;
		slug: string;
		seriesId?: string | null;
		isActive: number;
		imageUrl: string | null;
		minPlayers: number | null;
		maxPlayers: number | null;
		rulebookUrl: string | null;
		sport: string | null;
		type: 'league' | 'tournament';
		description: string | null;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<Offering | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(offerings)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				seasonId: data.seasonId,
				name: data.name,
				slug: data.slug,
				seriesId: data.seriesId ?? null,
				isActive: data.isActive,
				imageUrl: data.imageUrl,
				minPlayers: data.minPlayers,
				maxPlayers: data.maxPlayers,
				rulebookUrl: data.rulebookUrl,
				sport: data.sport,
				type: data.type,
				description: data.description,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}

	async updateSeriesId(
		clientId: string,
		offeringId: string,
		seriesId: string,
		updatedUser?: string | null
	): Promise<Offering | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(offerings)
			.set({
				seriesId,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(and(eq(offerings.clientId, clientId), eq(offerings.id, offeringId)))
			.returning();

		return result[0] ?? null;
	}

	async backfillSeriesIdsBySharedName(
		clientId: string,
		updatedUser?: string | null
	): Promise<number> {
		const existingOfferings = await this.getByClientId(clientId);
		const updates = buildOfferingSeriesBackfillPlan(existingOfferings, () => crypto.randomUUID());

		for (const update of updates) {
			await this.updateSeriesId(clientId, update.offeringId, update.seriesId, updatedUser);
		}

		return updates.length;
	}

	async updateByClientIdAndId(
		clientId: string,
		offeringId: string,
		data: {
			name: string;
			slug: string;
			isActive: number;
			imageUrl: string | null;
			minPlayers: number | null;
			maxPlayers: number | null;
			rulebookUrl: string | null;
			sport: string | null;
			description: string | null;
		},
		updatedUser?: string | null
	): Promise<Offering | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(offerings)
			.set({
				name: data.name,
				slug: data.slug,
				isActive: data.isActive,
				imageUrl: data.imageUrl,
				minPlayers: data.minPlayers,
				maxPlayers: data.maxPlayers,
				rulebookUrl: data.rulebookUrl,
				sport: data.sport,
				description: data.description,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(and(eq(offerings.clientId, clientId), eq(offerings.id, offeringId)))
			.returning();

		return result[0] ?? null;
	}

	async deleteById(id: string): Promise<boolean> {
		const result = await this.db.delete(offerings).where(eq(offerings.id, id)).returning();
		return result.length > 0;
	}
}
