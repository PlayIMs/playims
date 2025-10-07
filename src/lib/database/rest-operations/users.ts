// User operations using D1 REST API (for Vercel production)
import { D1RestClient } from '../d1-client.js';
import type { User } from '../schema.js';

export class UserRestOperations {
	constructor(private client: D1RestClient) {}

	async getAll(): Promise<User[]> {
		const result = await this.client.query('SELECT * FROM users ORDER BY created_at DESC');
		return result.results || [];
	}

	async getById(id: string): Promise<User | null> {
		const result = await this.client.query('SELECT * FROM users WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getByEmail(email: string): Promise<User | null> {
		const result = await this.client.query('SELECT * FROM users WHERE email = ?', [email]);
		return result.results?.[0] || null;
	}

	async getByClientId(clientId: string): Promise<User[]> {
		const result = await this.client.query(
			'SELECT * FROM users WHERE client_id = ? ORDER BY created_at DESC',
			[clientId]
		);
		return result.results || [];
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
		const result = await this.client.query(
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
		const updates: string[] = [];
		const values: any[] = [];

		Object.entries(data).forEach(([key, value]) => {
			if (value !== undefined) {
				// Convert camelCase to snake_case for database
				const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
				updates.push(`${dbKey} = ?`);
				values.push(value);
			}
		});

		if (updates.length === 0) {
			return this.getById(id);
		}

		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(id);

		const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.client.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.client.query('DELETE FROM users WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async updateLastLogin(id: string): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.client.query(
			'UPDATE users SET last_login_at = ?, last_active_at = ?, updated_at = ? WHERE id = ? RETURNING *',
			[now, now, now, id]
		);
		return result.results?.[0] || null;
	}

	async search(searchTerm: string): Promise<User[]> {
		const result = await this.client.query(
			'SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC',
			[`%${searchTerm}%`]
		);
		return result.results || [];
	}
}
