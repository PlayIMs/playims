// Client operations - Drizzle ORM
import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clients, type Client } from '../schema/index.js';

export class ClientOperations {
	constructor(private db: DrizzleClient) {}

	async getById(id: string): Promise<Client | null> {
		const result = await this.db.select().from(clients).where(eq(clients.id, id));
		return result[0] || null;
	}

	async create(data: {
		id?: string;
		name: string;
		slug: string;
		metadata?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Client | null> {
		const now = new Date().toISOString();
		const id = data.id || crypto.randomUUID();

		const result = await this.db
			.insert(clients)
			.values({
				id,
				name: data.name,
				slug: data.slug,
				metadata: data.metadata || null,
				status: 'active',
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser || null,
				updatedUser: data.updatedUser || data.createdUser || null
			})
			.returning();

		return result[0] || null;
	}
}
