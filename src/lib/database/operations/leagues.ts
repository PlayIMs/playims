// League operations - Drizzle ORM
import { and, asc, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { leagues, type League } from '../schema/index.js';

export class LeagueOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.clientId, clientId))
			.orderBy(desc(leagues.year), asc(leagues.stackOrder), desc(leagues.createdAt));
	}

	async getByClientIdAndSlug(clientId: string, slug: string): Promise<League | null> {
		const result = await this.db
			.select()
			.from(leagues)
			.where(and(eq(leagues.clientId, clientId), eq(leagues.slug, slug)))
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

	async deleteByOfferingId(offeringId: string): Promise<number> {
		const result = await this.db
			.delete(leagues)
			.where(eq(leagues.offeringId, offeringId))
			.returning({ id: leagues.id });
		return result.length;
	}
}
