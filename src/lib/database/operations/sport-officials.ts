// Sport official operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { sportOfficials, type SportOfficial } from '../schema/index.js';

export class SportOfficialOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<SportOfficial[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(sportOfficials)
				.where(eq(sportOfficials.clientId, clientId))
				.orderBy(desc(sportOfficials.createdAt));
		}

		return await this.db.select().from(sportOfficials).orderBy(desc(sportOfficials.createdAt));
	}

	async getById(id: string): Promise<SportOfficial | null> {
		const result = await this.db.select().from(sportOfficials).where(eq(sportOfficials.id, id));
		return result[0] || null;
	}

	async getByEventId(eventId: string): Promise<SportOfficial[]> {
		return await this.db
			.select()
			.from(sportOfficials)
			.where(eq(sportOfficials.eventId, eventId))
			.orderBy(desc(sportOfficials.createdAt));
	}

	async create(data: {
		clientId?: string;
		eventId?: string;
		userId?: string;
		role?: string;
		status?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<SportOfficial | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(sportOfficials)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				eventId: data.eventId || null,
				userId: data.userId || null,
				role: data.role || null,
				status: data.status || null,
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
			eventId: string;
			userId: string;
			role: string;
			status: string;
			updatedUser: string;
		}>
	): Promise<SportOfficial | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(sportOfficials)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(sportOfficials.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(sportOfficials).where(eq(sportOfficials.id, id)).returning();
		return result.length > 0;
	}
}
