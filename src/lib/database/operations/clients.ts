// Client operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clients, type Client } from '../schema.js';

export class ClientOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Client[]> {
		return await this.db.select().from(clients).orderBy(desc(clients.createdAt));
	}

	async getById(id: string): Promise<Client | null> {
		const result = await this.db.select().from(clients).where(eq(clients.id, id));
		return result[0] || null;
	}

	async getBySlug(slug: string): Promise<Client | null> {
		const result = await this.db.select().from(clients).where(eq(clients.slug, slug));
		return result[0] || null;
	}

	async getActive(): Promise<Client[]> {
		return await this.db
			.select()
			.from(clients)
			.where(eq(clients.status, 'active'))
			.orderBy(desc(clients.createdAt));
	}

	async create(data: { name: string; slug: string; metadata?: string }): Promise<Client | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(clients)
			.values({
				id,
				name: data.name,
				slug: data.slug,
				metadata: data.metadata || null,
				status: 'active',
				createdAt: now,
				updatedAt: now
			})
			.returning();

		return result[0] || null;
	}

	async update(
		id: string,
		data: Partial<{ name: string; slug: string; status: string; metadata: string }>
	): Promise<Client | null> {
		const now = new Date().toISOString();
		
		const result = await this.db
			.update(clients)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(clients.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(clients).where(eq(clients.id, id)).returning();
		return result.length > 0;
	}
}
