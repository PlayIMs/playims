// User operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';
import { mapUserRow } from './mappers.js';

// User type definition (matching database schema)
export interface User {
	id: string;
	clientId: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	avatarUrl: string | null;
	status: string;
	role: string;
	timezone: string | null;
	preferences: string | null;
	notes: string | null;
	lastLoginAt: string | null;
	lastActiveAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export class UserOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<any[]> {
		const result = await this.db.query(
			[
				'SELECT',
				'  u.*,',
				'  c.id AS c_id,',
				'  c.name AS c_name,',
				'  c.slug AS c_slug,',
				'  c.status AS c_status,',
				'  c.metadata AS c_metadata,',
				'  c.created_at AS c_created_at,',
				'  c.updated_at AS c_updated_at',
				'FROM users u',
				'LEFT JOIN clients c ON u.client_id = c.id',
				'ORDER BY u.created_at DESC'
			].join(' ')
		);
		return (result.results || []).map((row: Record<string, unknown>) => mapUserRow(row));
	}

	async getById(id: string): Promise<any | null> {
		const result = await this.db.query(
			[
				'SELECT',
				'  u.*,',
				'  c.id AS c_id,',
				'  c.name AS c_name,',
				'  c.slug AS c_slug,',
				'  c.status AS c_status,',
				'  c.metadata AS c_metadata,',
				'  c.created_at AS c_created_at,',
				'  c.updated_at AS c_updated_at',
				'FROM users u',
				'LEFT JOIN clients c ON u.client_id = c.id',
				'WHERE u.id = ?'
			].join(' '),
			[id]
		);
		const row = result.results?.[0];
		return row ? mapUserRow(row as Record<string, unknown>) : null;
	}

	async getByEmail(email: string): Promise<any | null> {
		const result = await this.db.query(
			[
				'SELECT',
				'  u.*,',
				'  c.id AS c_id,',
				'  c.name AS c_name,',
				'  c.slug AS c_slug,',
				'  c.status AS c_status,',
				'  c.metadata AS c_metadata,',
				'  c.created_at AS c_created_at,',
				'  c.updated_at AS c_updated_at',
				'FROM users u',
				'LEFT JOIN clients c ON u.client_id = c.id',
				'WHERE u.email = ?'
			].join(' '),
			[email]
		);
		const row = result.results?.[0];
		return row ? mapUserRow(row as Record<string, unknown>) : null;
	}

	async getByClientId(clientId: string): Promise<any[]> {
		const result = await this.db.query(
			[
				'SELECT',
				'  u.*,',
				'  c.id AS c_id,',
				'  c.name AS c_name,',
				'  c.slug AS c_slug,',
				'  c.status AS c_status,',
				'  c.metadata AS c_metadata,',
				'  c.created_at AS c_created_at,',
				'  c.updated_at AS c_updated_at',
				'FROM users u',
				'LEFT JOIN clients c ON u.client_id = c.id',
				'WHERE u.client_id = ?',
				'ORDER BY u.created_at DESC'
			].join(' '),
			[clientId]
		);
		return (result.results || []).map((row: Record<string, unknown>) => mapUserRow(row));
	}

	async create(data: {
		clientId: string;
		email: string;
		firstName?: string;
		lastName?: string;
		role?: string;
	}): Promise<any> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		await this.db.query(
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
		return this.getById(id);
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
	): Promise<any | null> {
		const now = new Date().toISOString();

		const updates: string[] = [];
		const values: (string | number)[] = [];

		Object.entries(data).forEach(([key, value]) => {
			if (value !== undefined) {
				const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
				updates.push(`${dbKey} = ?`);
				values.push(value as string | number);
			}
		});

		if (updates.length === 0) {
			return this.getById(id);
		}

		updates.push('updated_at = ?');
		values.push(now);
		values.push(id);

		const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		await this.db.query(query, values);
		return this.getById(id);
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.query('DELETE FROM users WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async updateLastLogin(id: string): Promise<any | null> {
		const now = new Date().toISOString();

		await this.db.query(
			'UPDATE users SET last_login_at = ?, last_active_at = ?, updated_at = ? WHERE id = ? RETURNING *',
			[now, now, now, id]
		);
		return this.getById(id);
	}

	async search(searchTerm: string): Promise<any[]> {
		const result = await this.db.query(
			[
				'SELECT',
				'  u.*,',
				'  c.id AS c_id,',
				'  c.name AS c_name,',
				'  c.slug AS c_slug,',
				'  c.status AS c_status,',
				'  c.metadata AS c_metadata,',
				'  c.created_at AS c_created_at,',
				'  c.updated_at AS c_updated_at',
				'FROM users u',
				'LEFT JOIN clients c ON u.client_id = c.id',
				'WHERE u.email LIKE ?',
				'ORDER BY u.created_at DESC'
			].join(' '),
			[`%${searchTerm}%`]
		);
		return (result.results || []).map((row: Record<string, unknown>) => mapUserRow(row));
	}
}
