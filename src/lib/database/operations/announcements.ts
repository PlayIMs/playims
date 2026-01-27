// Announcement operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { announcements, type Announcement } from '../schema/index.js';

export class AnnouncementOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<Announcement[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(announcements)
				.where(eq(announcements.clientId, clientId))
				.orderBy(desc(announcements.publishedAt));
		}

		return await this.db.select().from(announcements).orderBy(desc(announcements.publishedAt));
	}

	async getById(id: string): Promise<Announcement | null> {
		const result = await this.db.select().from(announcements).where(eq(announcements.id, id));
		return result[0] || null;
	}

	async getByLeagueId(leagueId: string): Promise<Announcement[]> {
		return await this.db
			.select()
			.from(announcements)
			.where(eq(announcements.leagueId, leagueId))
			.orderBy(desc(announcements.publishedAt));
	}

	async getByDivisionId(divisionId: string): Promise<Announcement[]> {
		return await this.db
			.select()
			.from(announcements)
			.where(eq(announcements.divisionId, divisionId))
			.orderBy(desc(announcements.publishedAt));
	}

	async create(data: {
		clientId?: string;
		leagueId?: string;
		divisionId?: string;
		title: string;
		body?: string;
		publishedAt?: string;
		isPinned?: number;
		isActive?: number;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Announcement | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(announcements)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				leagueId: data.leagueId || null,
				divisionId: data.divisionId || null,
				title: data.title,
				body: data.body || null,
				publishedAt: data.publishedAt || now,
				isPinned: data.isPinned ?? 0,
				isActive: data.isActive ?? 1,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser || null,
				updatedUser: data.updatedUser || data.createdUser || null
			})
			.returning();

		return result[0] || null;
	}

	async update(
		id: string,
		data: Partial<{
			title: string;
			body: string;
			publishedAt: string;
			isPinned: number;
			isActive: number;
			updatedUser: string;
		}>
	): Promise<Announcement | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(announcements)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(announcements.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(announcements).where(eq(announcements.id, id)).returning();
		return result.length > 0;
	}
}
