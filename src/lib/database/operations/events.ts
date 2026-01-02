// Event operations - Drizzle ORM
import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { events, type Event } from '../schema/index.js';

export class EventOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<Event[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(events)
				.where(eq(events.clientId, clientId))
				.orderBy(desc(events.date));
		}
		return await this.db.select().from(events).orderBy(desc(events.date));
	}

	async getById(id: string): Promise<Event | null> {
		const result = await this.db.select().from(events).where(eq(events.id, id));
		return result[0] || null;
	}

	async create(data: {
		clientId: string;
		title: string;
		description?: string;
		date: string;
		location?: string;
		type: string;
	}): Promise<Event | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(events)
			.values({
				id,
				clientId: data.clientId,
				title: data.title,
				description: data.description || null,
				date: data.date,
				location: data.location || null,
				type: data.type,
				isActive: 1,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		return result[0] || null;
	}

	async update(
		id: string,
		data: Partial<{
			title: string;
			description: string;
			date: string;
			location: string;
			type: string;
			isActive: number;
		}>
	): Promise<Event | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(events)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(events.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(events).where(eq(events.id, id)).returning();
		return result.length > 0;
	}
}
