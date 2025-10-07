// User operations - Works with both Drizzle (local) and REST API (production)
import { eq, desc, like } from 'drizzle-orm';
import { users, type User } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class UserOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<User[]> {
		if (this.isDrizzle) {
			return await (this.db as any).select().from(users).orderBy(desc(users.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM users ORDER BY created_at DESC'
			);
			return result.results || [];
		}
	}

	async getById(id: string): Promise<User | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any).select().from(users).where(eq(users.id, id)).limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM users WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getByEmail(email: string): Promise<User | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(users)
				.where(eq(users.email, email))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM users WHERE email = ?', [
				email
			]);
			return result.results?.[0] || null;
		}
	}

	async getByClientId(clientId: string): Promise<User[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(users)
				.where(eq(users.clientId, clientId))
				.orderBy(desc(users.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM users WHERE client_id = ? ORDER BY created_at DESC',
				[clientId]
			);
			return result.results || [];
		}
	}

	async create(data: {
		clientId: string;
		email: string;
		firstName?: string;
		lastName?: string;
		role?: string;
	}): Promise<User> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(users)
				.values({
					id,
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
		} else {
			const result = await (this.db as D1RestClient).query(
				'INSERT INTO users (id, client_id, email, first_name, last_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
				[
					id,
					data.clientId,
					data.email,
					data.firstName || null,
					data.lastName || null,
					data.role || 'player',
					'active',
					now,
					now
				]
			);
			return result.results[0];
		}
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
	): Promise<User | null> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(users)
				.set(updateData)
				.where(eq(users.id, id))
				.returning();
			return result[0] || null;
		} else {
			const updates: string[] = [];
			const values: any[] = [];

			Object.entries(data).forEach(([key, value]) => {
				if (value !== undefined) {
					const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
					updates.push(`${dbKey} = ?`);
					values.push(value);
				}
			});

			if (updates.length === 0) {
				return this.getById(id);
			}

			updates.push('updated_at = ?');
			values.push(now);
			values.push(id);

			const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: string): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any).delete(users).where(eq(users.id, id)).returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM users WHERE id = ?', [id]);
			return result.meta.changes > 0;
		}
	}

	async updateLastLogin(id: string): Promise<User | null> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(users)
				.set({
					lastLoginAt: now,
					lastActiveAt: now,
					updatedAt: now
				})
				.where(eq(users.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE users SET last_login_at = ?, last_active_at = ?, updated_at = ? WHERE id = ? RETURNING *',
				[now, now, now, id]
			);
			return result.results?.[0] || null;
		}
	}

	async search(searchTerm: string): Promise<User[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(users)
				.where(like(users.email, `%${searchTerm}%`))
				.orderBy(desc(users.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC',
				[`%${searchTerm}%`]
			);
			return result.results || [];
		}
	}
}
