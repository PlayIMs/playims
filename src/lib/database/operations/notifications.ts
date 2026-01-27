// Notification operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { notifications, type Notification } from '../schema/index.js';

export class NotificationOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<Notification[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(notifications)
				.where(eq(notifications.clientId, clientId))
				.orderBy(desc(notifications.createdAt));
		}

		return await this.db.select().from(notifications).orderBy(desc(notifications.createdAt));
	}

	async getById(id: string): Promise<Notification | null> {
		const result = await this.db.select().from(notifications).where(eq(notifications.id, id));
		return result[0] || null;
	}

	async getByUserId(userId: string): Promise<Notification[]> {
		return await this.db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, userId))
			.orderBy(desc(notifications.createdAt));
	}

	async create(data: {
		clientId?: string;
		userId?: string;
		type?: string;
		title?: string;
		body?: string;
		entityType?: string;
		entityId?: string;
		readAt?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Notification | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(notifications)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				userId: data.userId || null,
				type: data.type || null,
				title: data.title || null,
				body: data.body || null,
				entityType: data.entityType || null,
				entityId: data.entityId || null,
				readAt: data.readAt || null,
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
			type: string;
			title: string;
			body: string;
			entityType: string;
			entityId: string;
			readAt: string;
			updatedUser: string;
		}>
	): Promise<Notification | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(notifications)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(notifications.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(notifications).where(eq(notifications.id, id)).returning();
		return result.length > 0;
	}
}
