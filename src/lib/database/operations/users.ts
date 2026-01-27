// User operations - Drizzle ORM
import { eq, desc, like, count } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { users, clients, type User, type Client } from '../schema/index.js';

export class UserOperations {
	constructor(private db: DrizzleClient) {}

	private mapResult(row: { user: User; client: Client | null }) {
		return {
			...row.user,
			client: row.client
		};
	}

	async getAll(): Promise<any[]> {
		const result = await this.db
			.select({
				user: users,
				client: clients
			})
			.from(users)
			.leftJoin(clients, eq(users.clientId, clients.id))
			.orderBy(desc(users.createdAt));
			
		return result.map(this.mapResult);
	}

	async getById(id: string): Promise<any | null> {
		const result = await this.db
			.select({
				user: users,
				client: clients
			})
			.from(users)
			.leftJoin(clients, eq(users.clientId, clients.id))
			.where(eq(users.id, id));
			
		return result[0] ? this.mapResult(result[0]) : null;
	}

	async getByEmail(email: string): Promise<any | null> {
		const result = await this.db
			.select({
				user: users,
				client: clients
			})
			.from(users)
			.leftJoin(clients, eq(users.clientId, clients.id))
			.where(eq(users.email, email));
			
		return result[0] ? this.mapResult(result[0]) : null;
	}

	async getByClientId(clientId: string): Promise<any[]> {
		const result = await this.db
			.select({
				user: users,
				client: clients
			})
			.from(users)
			.leftJoin(clients, eq(users.clientId, clients.id))
			.where(eq(users.clientId, clientId))
			.orderBy(desc(users.createdAt));
			
		return result.map(this.mapResult);
	}

	async create(data: {
		clientId: string;
		email: string;
		firstName?: string;
		lastName?: string;
		role?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<User | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(users)
			.values({
				id,
				clientId: data.clientId,
				email: data.email,
				firstName: data.firstName || null,
				lastName: data.lastName || null,
				role: data.role || 'player',
				status: 'active',
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
			email: string;
			firstName: string;
			lastName: string;
			avatarUrl: string;
			status: string;
			role: string;
			timezone: string;
			preferences: string;
			notes: string;
			updatedUser: string;
		}>
	): Promise<User | null> {
		const now = new Date().toISOString();
		
		const result = await this.db
			.update(users)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(users.id, id))
			.returning();
			
		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(users).where(eq(users.id, id)).returning();
		return result.length > 0;
	}

	async updateLastLogin(id: string): Promise<User | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(users)
			.set({
				lastLoginAt: now,
				lastActiveAt: now,
				updatedAt: now
			})
			.where(eq(users.id, id))
			.returning();
			
		return result[0] || null;
	}

	async search(searchTerm: string): Promise<any[]> {
		const result = await this.db
			.select({
				user: users,
				client: clients
			})
			.from(users)
			.leftJoin(clients, eq(users.clientId, clients.id))
			.where(like(users.email, `%${searchTerm}%`))
			.orderBy(desc(users.createdAt));
			
		return result.map(this.mapResult);
	}

	async count(): Promise<number> {
		const result = await this.db.select({ count: count() }).from(users);
		return result[0]?.count || 0;
	}
}
