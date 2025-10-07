// Client operations - CRUD methods for clients table
import { eq, desc } from 'drizzle-orm';
import { clients, type Client, type NewClient } from '../schema.js';

export class ClientOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(clients).orderBy(desc(clients.createdAt));
	}

	async getById(id: string) {
		const result = await this.db.select().from(clients).where(eq(clients.id, id)).limit(1);
		return result[0] || null;
	}

	async create(data: { name: string; slug: string; metadata?: string }) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clients)
			.values({
				id: crypto.randomUUID(),
				name: data.name,
				slug: data.slug,
				metadata: data.metadata || null,
				createdAt: now,
				updatedAt: now,
				status: 'active'
			})
			.returning();

		return result[0];
	}

	async update(
		id: string,
		data: Partial<{ name: string; slug: string; status: string; metadata: string }>
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(clients)
			.set(updateData)
			.where(eq(clients.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string) {
		const result = await this.db.delete(clients).where(eq(clients.id, id)).returning();
		return result.length > 0;
	}

	async getBySlug(slug: string) {
		const result = await this.db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
		return result[0] || null;
	}

	async getActive() {
		return await this.db
			.select()
			.from(clients)
			.where(eq(clients.status, 'active'))
			.orderBy(desc(clients.createdAt));
	}
}
