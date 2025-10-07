// User operations - CRUD methods for users table
import { eq, desc, like } from 'drizzle-orm';
import { users, type User, type NewUser } from '../schema.js';

export class UserOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(users).orderBy(desc(users.createdAt));
	}

	async getById(id: string) {
		const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
		return result[0] || null;
	}

	async getByEmail(email: string) {
		const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
		return result[0] || null;
	}

	async getByClientId(clientId: string) {
		return await this.db
			.select()
			.from(users)
			.where(eq(users.clientId, clientId))
			.orderBy(desc(users.createdAt));
	}

	async create(data: {
		clientId: string;
		email: string;
		firstName?: string;
		lastName?: string;
		role?: string;
	}) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				email: data.email,
				firstName: data.firstName || null,
				lastName: data.lastName || null,
				role: data.role || 'player',
				createdAt: now,
				updatedAt: now,
				status: 'active'
			})
			.returning();

		return result[0];
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
		}>
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db.update(users).set(updateData).where(eq(users.id, id)).returning();

		return result[0] || null;
	}

	async delete(id: string) {
		const result = await this.db.delete(users).where(eq(users.id, id)).returning();
		return result.length > 0;
	}

	async updateLastLogin(id: string) {
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

	async search(searchTerm: string) {
		return await this.db
			.select()
			.from(users)
			.where(
				like(users.email, `%${searchTerm}%`)
				// You can add more search fields here
			)
			.orderBy(desc(users.createdAt));
	}
}
