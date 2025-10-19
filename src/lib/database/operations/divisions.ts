// Division operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';

// Division type definition (matching database schema)
export interface Division {
	id: string;
	leagueId: string;
	name: string;
	slug: string;
	description: string | null;
	maxTeams: number | null;
	isActive: number;
	createdAt: string;
	updatedAt: string;
}

export class DivisionOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<Division[]> {
		const result = await this.db.query('SELECT * FROM divisions ORDER BY name ASC');
		return result.results || [];
	}

	async getById(id: string): Promise<Division | null> {
		const result = await this.db.query('SELECT * FROM divisions WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getBySlug(slug: string): Promise<Division | null> {
		const result = await this.db.query('SELECT * FROM divisions WHERE slug = ?', [slug]);
		return result.results?.[0] || null;
	}

	async getByLeagueId(leagueId: string): Promise<Division[]> {
		const result = await this.db.query(
			'SELECT * FROM divisions WHERE league_id = ? ORDER BY name ASC',
			[leagueId]
		);
		return result.results || [];
	}

	async getActive(): Promise<Division[]> {
		const result = await this.db.query(
			'SELECT * FROM divisions WHERE is_active = 1 ORDER BY name ASC'
		);
		return result.results || [];
	}

	async create(data: {
		leagueId: string;
		name: string;
		slug: string;
		description?: string;
		maxTeams?: number;
	}): Promise<Division> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db.query(
			'INSERT INTO divisions (id, league_id, name, slug, description, max_teams, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[
				id,
				data.leagueId,
				data.name,
				data.slug,
				data.description || null,
				data.maxTeams || null,
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
			description: string;
			maxTeams: number;
			isActive: number;
		}>
	): Promise<Division | null> {
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

		const query = `UPDATE divisions SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.db.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.query('DELETE FROM divisions WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async toggleActive(id: string): Promise<Division | null> {
		const division = await this.getById(id);
		if (!division) return null;

		const newStatus = division.isActive === 1 ? 0 : 1;

		const result = await this.db.query(
			'UPDATE divisions SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *',
			[newStatus, new Date().toISOString(), id]
		);
		return result.results?.[0] || null;
	}
}
