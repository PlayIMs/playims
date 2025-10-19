// Sport operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';

// Sport type definition (matching database schema)
export interface Sport {
	id: string;
	name: string;
	slug: string;
	type: string | null;
	description: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	clientId: string | null;
	isActive: number;
	imageUrl: string | null;
	rulebookUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export class SportOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<Sport[]> {
		const result = await this.db.query('SELECT * FROM sports ORDER BY name ASC');
		return result.results || [];
	}

	async getById(id: string): Promise<Sport | null> {
		const result = await this.db.query('SELECT * FROM sports WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getBySlug(slug: string): Promise<Sport | null> {
		const result = await this.db.query('SELECT * FROM sports WHERE slug = ?', [slug]);
		return result.results?.[0] || null;
	}

	async getActive(): Promise<Sport[]> {
		const result = await this.db.query(
			'SELECT * FROM sports WHERE is_active = 1 ORDER BY name ASC'
		);
		return result.results || [];
	}

	async getByClientId(clientId: string): Promise<Sport[]> {
		const result = await this.db.query(
			'SELECT * FROM sports WHERE client_id = ? ORDER BY name ASC',
			[clientId]
		);
		return result.results || [];
	}

	async create(data: {
		name: string;
		slug: string;
		type?: string;
		description?: string;
		minPlayers?: number;
		maxPlayers?: number;
		clientId?: string;
	}): Promise<Sport> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db.query(
			'INSERT INTO sports (id, name, slug, type, description, min_players, max_players, client_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[
				id,
				data.name,
				data.slug,
				data.type || null,
				data.description || null,
				data.minPlayers || null,
				data.maxPlayers || null,
				data.clientId || null,
				1,
				now,
				now
			]
		);
		return result.results[0];
	}

	async update(
		id: string,
		data: Partial<{
			name: string;
			slug: string;
			type: string;
			description: string;
			minPlayers: number;
			maxPlayers: number;
			isActive: number;
			imageUrl: string;
			rulebookUrl: string;
		}>
	): Promise<Sport | null> {
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

		if (updates.length === 0) return this.getById(id);

		updates.push('updated_at = ?');
		values.push(now);
		values.push(id);

		const query = `UPDATE sports SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.db.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.query('DELETE FROM sports WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async toggleActive(id: string): Promise<Sport | null> {
		const sport = await this.getById(id);
		if (!sport) return null;

		const newStatus = sport.isActive === 1 ? 0 : 1;

		const result = await this.db.query(
			'UPDATE sports SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *',
			[newStatus, new Date().toISOString(), id]
		);
		return result.results?.[0] || null;
	}
}
