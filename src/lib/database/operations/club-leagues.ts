import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubLeagues, type ClubLeague } from '../schema/index.js';

export class ClubLeagueOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClubLeague[]> {
		return await this.db
			.select()
			.from(clubLeagues)
			.where(eq(clubLeagues.clientId, clientId))
			.orderBy(asc(clubLeagues.stackOrder), asc(clubLeagues.name));
	}

	async getByClientIdAndId(clientId: string, leagueId: string): Promise<ClubLeague | null> {
		const result = await this.db
			.select()
			.from(clubLeagues)
			.where(and(eq(clubLeagues.clientId, clientId), eq(clubLeagues.id, leagueId)))
			.limit(1);
		return result[0] ?? null;
	}

	async getByClubId(clubId: string): Promise<ClubLeague[]> {
		return await this.db
			.select()
			.from(clubLeagues)
			.where(eq(clubLeagues.clubId, clubId))
			.orderBy(asc(clubLeagues.stackOrder), asc(clubLeagues.name));
	}

	async getByClubIdAndSlug(clubId: string, slug: string): Promise<ClubLeague | null> {
		const result = await this.db
			.select()
			.from(clubLeagues)
			.where(and(eq(clubLeagues.clubId, clubId), eq(clubLeagues.slug, slug)))
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		clubSeasonId: string;
		clubId: string;
		name: string;
		slug: string;
		stackOrder: number;
		description: string | null;
		gender: string | null;
		regStartDate: string | null;
		regEndDate: string | null;
		seasonStartDate: string | null;
		seasonEndDate: string | null;
		isActive: number;
		isLocked: number;
		imageUrl: string | null;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<ClubLeague | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clubLeagues)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				clubSeasonId: data.clubSeasonId,
				clubId: data.clubId,
				name: data.name,
				slug: data.slug,
				stackOrder: data.stackOrder,
				description: data.description,
				gender: data.gender,
				regStartDate: data.regStartDate,
				regEndDate: data.regEndDate,
				seasonStartDate: data.seasonStartDate,
				seasonEndDate: data.seasonEndDate,
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
}
