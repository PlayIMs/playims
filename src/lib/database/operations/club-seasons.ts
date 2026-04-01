import { and, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubSeasons, type ClubSeason } from '../schema/index.js';

export class ClubSeasonOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClubSeason[]> {
		return await this.db
			.select()
			.from(clubSeasons)
			.where(eq(clubSeasons.clientId, clientId))
			.orderBy(desc(clubSeasons.startDate), desc(clubSeasons.createdAt));
	}

	async getByClientIdAndSlug(clientId: string, slug: string): Promise<ClubSeason | null> {
		const result = await this.db
			.select()
			.from(clubSeasons)
			.where(and(eq(clubSeasons.clientId, clientId), eq(clubSeasons.slug, slug)))
			.limit(1);
		return result[0] ?? null;
	}

	async getByClientIdAndId(clientId: string, seasonId: string): Promise<ClubSeason | null> {
		const result = await this.db
			.select()
			.from(clubSeasons)
			.where(and(eq(clubSeasons.clientId, clientId), eq(clubSeasons.id, seasonId)))
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		name: string;
		slug: string;
		startDate: string;
		endDate: string | null;
		isCurrent: number;
		isActive: number;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<ClubSeason | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clubSeasons)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				name: data.name,
				slug: data.slug,
				startDate: data.startDate,
				endDate: data.endDate,
				isCurrent: data.isCurrent,
				isActive: data.isActive,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();
		return result[0] ?? null;
	}

	async setCurrent(clientId: string, seasonId: string): Promise<void> {
		await this.db
			.update(clubSeasons)
			.set({ isCurrent: 0, updatedAt: new Date().toISOString() })
			.where(eq(clubSeasons.clientId, clientId));
		await this.db
			.update(clubSeasons)
			.set({ isCurrent: 1, updatedAt: new Date().toISOString() })
			.where(and(eq(clubSeasons.clientId, clientId), eq(clubSeasons.id, seasonId)));
	}

	async updateDetails(
		clientId: string,
		seasonId: string,
		data: {
			name: string;
			slug: string;
			startDate: string;
			endDate: string | null;
			isCurrent: number;
			isActive: number;
			updatedUser?: string | null;
		}
	): Promise<ClubSeason | null> {
		const result = await this.db
			.update(clubSeasons)
			.set({
				name: data.name,
				slug: data.slug,
				startDate: data.startDate,
				endDate: data.endDate,
				isCurrent: data.isCurrent,
				isActive: data.isActive,
				updatedAt: new Date().toISOString(),
				updatedUser: data.updatedUser ?? null
			})
			.where(and(eq(clubSeasons.clientId, clientId), eq(clubSeasons.id, seasonId)))
			.returning();
		return result[0] ?? null;
	}
}
