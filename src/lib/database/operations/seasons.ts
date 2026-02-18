// Season operations - Drizzle ORM
import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { seasons, type Season } from '../schema/index.js';

export class SeasonOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Season[]> {
		return await this.db
			.select()
			.from(seasons)
			.where(eq(seasons.clientId, clientId))
			.orderBy(asc(seasons.startDate), asc(seasons.name));
	}

	async getCurrentByClientId(clientId: string): Promise<Season | null> {
		const result = await this.db
			.select()
			.from(seasons)
			.where(and(eq(seasons.clientId, clientId), eq(seasons.isCurrent, 1)))
			.limit(1);

		return result[0] ?? null;
	}

	async getByClientIdAndSlug(clientId: string, slug: string): Promise<Season | null> {
		const result = await this.db
			.select()
			.from(seasons)
			.where(and(eq(seasons.clientId, clientId), eq(seasons.slug, slug)))
			.limit(1);
		return result[0] ?? null;
	}

	async getByClientIdAndId(clientId: string, seasonId: string): Promise<Season | null> {
		const result = await this.db
			.select()
			.from(seasons)
			.where(and(eq(seasons.clientId, clientId), eq(seasons.id, seasonId)))
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
	}): Promise<Season | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(seasons)
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

	async setCurrent(clientId: string, seasonId: string, updatedUser?: string | null): Promise<void> {
		const now = new Date().toISOString();
		await this.db
			.update(seasons)
			.set({
				isCurrent: 0,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(eq(seasons.clientId, clientId));

		await this.db
			.update(seasons)
			.set({
				isCurrent: 1,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(and(eq(seasons.clientId, clientId), eq(seasons.id, seasonId)));
	}

	async updateDetails(
		clientId: string,
		seasonId: string,
		data: {
			name: string;
			slug: string;
			startDate: string;
			endDate: string | null;
		},
		updatedUser?: string | null
	): Promise<Season | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(seasons)
			.set({
				name: data.name,
				slug: data.slug,
				startDate: data.startDate,
				endDate: data.endDate,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(and(eq(seasons.clientId, clientId), eq(seasons.id, seasonId)))
			.returning();

		return result[0] ?? null;
	}

	async setActive(
		clientId: string,
		seasonId: string,
		isActive: boolean,
		updatedUser?: string | null
	): Promise<void> {
		const now = new Date().toISOString();
		await this.db
			.update(seasons)
			.set({
				isActive: isActive ? 1 : 0,
				updatedAt: now,
				updatedUser: updatedUser ?? null
			})
			.where(and(eq(seasons.clientId, clientId), eq(seasons.id, seasonId)));
	}
}
