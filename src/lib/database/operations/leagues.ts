// League operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';

// League type definition (matching database schema)
export interface League {
	id: string;
	clientId: string;
	sportId: string;
	name: string;
	slug: string;
	year: number;
	season: string | null;
	description: string | null;
	gender: string | null;
	skillLevel: string | null;
	regStartDate: string | null;
	regEndDate: string | null;
	seasonStartDate: string | null;
	seasonEndDate: string | null;
	isActive: number;
	isLocked: number;
	createdAt: string;
	updatedAt: string;
}

export class LeagueOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<League[]> {
		const result = await this.db.query('SELECT * FROM leagues ORDER BY created_at DESC');
		return result.results || [];
	}

	async getById(id: string): Promise<League | null> {
		const result = await this.db.query('SELECT * FROM leagues WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getBySlug(slug: string): Promise<League | null> {
		const result = await this.db.query('SELECT * FROM leagues WHERE slug = ?', [slug]);
		return result.results?.[0] || null;
	}

	async getByClientId(clientId: string): Promise<League[]> {
		const result = await this.db.query(
			'SELECT * FROM leagues WHERE client_id = ? ORDER BY year DESC, created_at DESC',
			[clientId]
		);
		return result.results || [];
	}

	async getBySportId(sportId: string): Promise<League[]> {
		const result = await this.db.query(
			'SELECT * FROM leagues WHERE sport_id = ? ORDER BY year DESC',
			[sportId]
		);
		return result.results || [];
	}

	async getActive(): Promise<League[]> {
		const result = await this.db.query(
			'SELECT * FROM leagues WHERE is_active = 1 ORDER BY season_start_date DESC'
		);
		return result.results || [];
	}

	async getByYearAndSeason(year: number, season: string): Promise<League[]> {
		const result = await this.db.query(
			'SELECT * FROM leagues WHERE year = ? AND season = ? ORDER BY created_at DESC',
			[year, season]
		);
		return result.results || [];
	}

	async create(data: {
		clientId: string;
		sportId: string;
		name: string;
		slug: string;
		year?: number;
		season?: string;
		description?: string;
		gender?: string;
		skillLevel?: string;
	}): Promise<League> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		const year = data.year || new Date().getFullYear();

		const result = await this.db.query(
			'INSERT INTO leagues (id, client_id, sport_id, name, slug, year, season, description, gender, skill_level, is_active, is_locked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[
				id,
				data.clientId,
				data.sportId,
				data.name,
				data.slug,
				year,
				data.season || null,
				data.description || null,
				data.gender || null,
				data.skillLevel || null,
				1,
				0,
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
			year: number;
			season: string;
			gender: string;
			skillLevel: string;
			regStartDate: string;
			regEndDate: string;
			seasonStartDate: string;
			seasonEndDate: string;
			isActive: number;
			isLocked: number;
		}>
	): Promise<League | null> {
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

		const query = `UPDATE leagues SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.db.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.query('DELETE FROM leagues WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async toggleActive(id: string): Promise<League | null> {
		const league = await this.getById(id);
		if (!league) return null;

		const newStatus = league.isActive === 1 ? 0 : 1;

		const result = await this.db.query(
			'UPDATE leagues SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *',
			[newStatus, new Date().toISOString(), id]
		);
		return result.results?.[0] || null;
	}

	async lock(id: string): Promise<League | null> {
		const result = await this.db.query(
			'UPDATE leagues SET is_locked = 1, updated_at = ? WHERE id = ? RETURNING *',
			[new Date().toISOString(), id]
		);
		return result.results?.[0] || null;
	}

	async unlock(id: string): Promise<League | null> {
		const result = await this.db.query(
			'UPDATE leagues SET is_locked = 0, updated_at = ? WHERE id = ? RETURNING *',
			[new Date().toISOString(), id]
		);
		return result.results?.[0] || null;
	}
}
