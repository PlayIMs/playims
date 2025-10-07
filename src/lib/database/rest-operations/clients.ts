// Client operations using D1 REST API (for Vercel production)
import { D1RestClient } from '../d1-client.js';
import type { Client } from '../schema.js';

export class ClientRestOperations {
	constructor(private client: D1RestClient) {}

	async getAll(): Promise<Client[]> {
		const result = await this.client.query('SELECT * FROM clients ORDER BY created_at DESC');
		return result.results || [];
	}

	async getById(id: string): Promise<Client | null> {
		const result = await this.client.query('SELECT * FROM clients WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getBySlug(slug: string): Promise<Client | null> {
		const result = await this.client.query('SELECT * FROM clients WHERE slug = ?', [slug]);
		return result.results?.[0] || null;
	}

	async getActive(): Promise<Client[]> {
		const result = await this.client.query(
			"SELECT * FROM clients WHERE status = 'active' ORDER BY created_at DESC"
		);
		return result.results || [];
	}

	async create(data: { name: string; slug: string; metadata?: string }): Promise<Client> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		const result = await this.client.query(
			'INSERT INTO clients (id, name, slug, metadata, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[id, data.name, data.slug, data.metadata || null, 'active', now, now]
		);
		return result.results[0];
	}

	async update(
		id: string,
		data: Partial<{ name: string; slug: string; status: string; metadata: string }>
	): Promise<Client | null> {
		const updates: string[] = [];
		const values: any[] = [];

		if (data.name !== undefined) {
			updates.push('name = ?');
			values.push(data.name);
		}
		if (data.slug !== undefined) {
			updates.push('slug = ?');
			values.push(data.slug);
		}
		if (data.status !== undefined) {
			updates.push('status = ?');
			values.push(data.status);
		}
		if (data.metadata !== undefined) {
			updates.push('metadata = ?');
			values.push(data.metadata);
		}

		if (updates.length === 0) {
			return this.getById(id);
		}

		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(id);

		const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.client.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.client.query('DELETE FROM clients WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}
}
