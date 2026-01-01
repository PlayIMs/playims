// Client operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';
import { mapClientRow } from './mappers.js';

// Client type definition (matching database schema)
export interface Client {
	id: string;
	name: string;
	slug: string;
	status: string;
	metadata: string | null;
	createdAt: string;
	updatedAt: string;
}

export class ClientOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<any[]> {
		const result = await this.db.query('SELECT * FROM clients ORDER BY created_at DESC');
		return (result.results || []).map((row: Record<string, unknown>) =>
			mapClientRow(row as Record<string, unknown>)
		);
	}

	async getById(id: string): Promise<any | null> {
		const result = await this.db.query('SELECT * FROM clients WHERE id = ?', [id]);
		const row = result.results?.[0];
		return row ? mapClientRow(row as Record<string, unknown>) : null;
	}

	async getBySlug(slug: string): Promise<any | null> {
		const result = await this.db.query('SELECT * FROM clients WHERE slug = ?', [slug]);
		const row = result.results?.[0];
		return row ? mapClientRow(row as Record<string, unknown>) : null;
	}

	async getActive(): Promise<any[]> {
		const result = await this.db.query(
			"SELECT * FROM clients WHERE status = 'active' ORDER BY created_at DESC"
		);
		return (result.results || []).map((row: Record<string, unknown>) => mapClientRow(row));
	}

	async create(data: { name: string; slug: string; metadata?: string }): Promise<any> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		await this.db.query(
			'INSERT INTO clients (id, name, slug, metadata, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[id, data.name, data.slug, data.metadata || null, 'active', now, now]
		);
		return this.getById(id);
	}

	async update(
		id: string,
		data: Partial<{ name: string; slug: string; status: string; metadata: string }>
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

		const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		await this.db.query(query, values);
		return this.getById(id);
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.query('DELETE FROM clients WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}
}
