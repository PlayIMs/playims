// Type-safe database operations using Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDrizzleClient, schema } from './drizzle.js';

// Platform interface for local development with wrangler
interface Platform {
	env?: {
		DB?: D1Database;
	};
}

export class DatabaseOperations {
	private db: ReturnType<typeof createDrizzleClient>;

	constructor(platform?: Platform) {
		this.db = createDrizzleClient(platform);
	}

	// Client operations
	async getAllClients() {
		return await this.db.select().from(schema.clients).orderBy(desc(schema.clients.createdAt));
	}

	async getClientById(id: number) {
		const result = await this.db
			.select()
			.from(schema.clients)
			.where(eq(schema.clients.id, id))
			.limit(1);

		return result[0] || null;
	}

	async createClient(data: { name: string; email: string }) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(schema.clients)
			.values({
				name: data.name,
				email: data.email,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		return result[0];
	}

	async updateClient(id: number, data: Partial<{ name: string; email: string }>) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(schema.clients)
			.set(updateData)
			.where(eq(schema.clients.id, id))
			.returning();

		return result[0] || null;
	}

	async deleteClient(id: number) {
		const result = await this.db
			.delete(schema.clients)
			.where(eq(schema.clients.id, id))
			.returning();

		return result.length > 0;
	}

	// User operations
	async getAllUsers() {
		return await this.db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
	}

	async getUserById(id: number) {
		const result = await this.db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, id))
			.limit(1);

		return result[0] || null;
	}

	async createUser(data: { username: string; email: string }) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(schema.users)
			.values({
				username: data.username,
				email: data.email,
				createdAt: now,
				updatedAt: now
			})
			.returning();

		return result[0];
	}

	async updateUser(id: number, data: Partial<{ username: string; email: string }>) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(schema.users)
			.set(updateData)
			.where(eq(schema.users.id, id))
			.returning();

		return result[0] || null;
	}

	async deleteUser(id: number) {
		const result = await this.db.delete(schema.users).where(eq(schema.users.id, id)).returning();

		return result.length > 0;
	}
}
