// Team operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';

// Team type definition (matching database schema)
export interface Team {
	id: number;
	divisionId: string;
	name: string;
	slug: string;
	description: string | null;
	logoUrl: string | null;
	primaryColor: string | null;
	secondaryColor: string | null;
	website: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	zipCode: string | null;
	country: string | null;
	isActive: number;
	createdAt: string;
	updatedAt: string;
}

export class TeamOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<Team[]> {
		const result = await this.db.query('SELECT * FROM teams ORDER BY created_at DESC');
		return result.results || [];
	}

	async getById(id: number): Promise<Team | null> {
		const result = await this.db.query('SELECT * FROM teams WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getBySlug(slug: string): Promise<Team | null> {
		const result = await this.db.query('SELECT * FROM teams WHERE slug = ?', [slug]);
		return result.results?.[0] || null;
	}

	async getByDivisionId(divisionId: string): Promise<Team[]> {
		const result = await this.db.query(
			'SELECT * FROM teams WHERE division_id = ? ORDER BY name ASC',
			[divisionId]
		);
		return result.results || [];
	}

	async getActive(): Promise<Team[]> {
		const result = await this.db.query('SELECT * FROM teams WHERE is_active = 1 ORDER BY name ASC');
		return result.results || [];
	}

	async create(data: {
		divisionId: string;
		name: string;
		slug: string;
		description?: string;
		logoUrl?: string;
		primaryColor?: string;
		secondaryColor?: string;
		website?: string;
		email?: string;
		phone?: string;
		address?: string;
		city?: string;
		state?: string;
		zipCode?: string;
		country?: string;
	}): Promise<Team> {
		const now = new Date().toISOString();

		const result = await this.db.query(
			'INSERT INTO teams (division_id, name, slug, description, logo_url, primary_color, secondary_color, website, email, phone, address, city, state, zip_code, country, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[
				data.divisionId,
				data.name,
				data.slug,
				data.description || null,
				data.logoUrl || null,
				data.primaryColor || null,
				data.secondaryColor || null,
				data.website || null,
				data.email || null,
				data.phone || null,
				data.address || null,
				data.city || null,
				data.state || null,
				data.zipCode || null,
				data.country || null,
				1,
				now,
				now
			]
		);
		return result.results[0];
	}

	async update(
		id: number,
		data: Partial<{
			name: string;
			slug: string;
			description: string;
			logoUrl: string;
			primaryColor: string;
			secondaryColor: string;
			website: string;
			email: string;
			phone: string;
			address: string;
			city: string;
			state: string;
			zipCode: string;
			country: string;
			isActive: number;
		}>
	): Promise<Team | null> {
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

		const query = `UPDATE teams SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.db.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db.query('DELETE FROM teams WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async toggleActive(id: number): Promise<Team | null> {
		const team = await this.getById(id);
		if (!team) return null;

		const newStatus = team.isActive === 1 ? 0 : 1;

		const result = await this.db.query(
			'UPDATE teams SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *',
			[newStatus, new Date().toISOString(), id]
		);
		return result.results?.[0] || null;
	}
}
