import { and, asc, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubs, type Club } from '../schema/index.js';

export class ClubOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Club[]> {
		return await this.db
			.select()
			.from(clubs)
			.where(eq(clubs.clientId, clientId))
			.orderBy(desc(clubs.createdAt), asc(clubs.name));
	}

	async getByClientIdAndId(clientId: string, clubId: string): Promise<Club | null> {
		const result = await this.db
			.select()
			.from(clubs)
			.where(and(eq(clubs.clientId, clientId), eq(clubs.id, clubId)))
			.limit(1);
		return result[0] ?? null;
	}

	async getByClientIdSeasonIdAndSlug(
		clientId: string,
		clubSeasonId: string,
		slug: string
	): Promise<Club | null> {
		const result = await this.db
			.select()
			.from(clubs)
			.where(
				and(
					eq(clubs.clientId, clientId),
					eq(clubs.clubSeasonId, clubSeasonId),
					eq(clubs.slug, slug)
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		clubSeasonId: string;
		name: string;
		slug: string;
		sport: string | null;
		description: string | null;
		imageUrl: string | null;
		isActive: number;
		seriesId?: string | null;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<Club | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clubs)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				clubSeasonId: data.clubSeasonId,
				name: data.name,
				slug: data.slug,
				sport: data.sport,
				description: data.description,
				imageUrl: data.imageUrl,
				isActive: data.isActive,
				seriesId: data.seriesId ?? null,
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
		clubId: string,
		data: {
			clubSeasonId: string;
			name: string;
			slug: string;
			sport: string | null;
			description: string | null;
			imageUrl: string | null;
			isActive: number;
			updatedUser?: string | null;
		}
	): Promise<Club | null> {
		const result = await this.db
			.update(clubs)
			.set({
				clubSeasonId: data.clubSeasonId,
				name: data.name,
				slug: data.slug,
				sport: data.sport,
				description: data.description,
				imageUrl: data.imageUrl,
				isActive: data.isActive,
				updatedAt: new Date().toISOString(),
				updatedUser: data.updatedUser ?? null
			})
			.where(and(eq(clubs.clientId, clientId), eq(clubs.id, clubId)))
			.returning();
		return result[0] ?? null;
	}
}
