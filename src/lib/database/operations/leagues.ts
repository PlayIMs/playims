// League operations - Works with both Drizzle (local) and REST API (production)
import { eq, desc, and } from 'drizzle-orm';
import { leagues, type League } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class LeagueOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<League[]> {
		if (this.isDrizzle) {
			return await (this.db as any).select().from(leagues).orderBy(desc(leagues.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM leagues ORDER BY created_at DESC'
			);
			return result.results || [];
		}
	}

	async getById(id: string): Promise<League | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(leagues)
				.where(eq(leagues.id, id))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM leagues WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getBySlug(slug: string): Promise<League | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(leagues)
				.where(eq(leagues.slug, slug))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM leagues WHERE slug = ?', [
				slug
			]);
			return result.results?.[0] || null;
		}
	}

	async getByClientId(clientId: string): Promise<League[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(leagues)
				.where(eq(leagues.clientId, clientId))
				.orderBy(desc(leagues.year), desc(leagues.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM leagues WHERE client_id = ? ORDER BY year DESC, created_at DESC',
				[clientId]
			);
			return result.results || [];
		}
	}

	async getBySportId(sportId: string): Promise<League[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(leagues)
				.where(eq(leagues.sportId, sportId))
				.orderBy(desc(leagues.year));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM leagues WHERE sport_id = ? ORDER BY year DESC',
				[sportId]
			);
			return result.results || [];
		}
	}

	async getActive(): Promise<League[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(leagues)
				.where(eq(leagues.isActive, 1))
				.orderBy(desc(leagues.seasonStartDate));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM leagues WHERE is_active = 1 ORDER BY season_start_date DESC'
			);
			return result.results || [];
		}
	}

	async getByYearAndSeason(year: number, season: string): Promise<League[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(leagues)
				.where(and(eq(leagues.year, year), eq(leagues.season, season)))
				.orderBy(desc(leagues.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM leagues WHERE year = ? AND season = ? ORDER BY created_at DESC',
				[year, season]
			);
			return result.results || [];
		}
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

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(leagues)
				.values({
					id,
					clientId: data.clientId,
					sportId: data.sportId,
					name: data.name,
					slug: data.slug,
					year,
					season: data.season || null,
					description: data.description || null,
					gender: data.gender || null,
					skillLevel: data.skillLevel || null,
					isActive: 1,
					isLocked: 0,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			return result[0];
		} else {
			const result = await (this.db as D1RestClient).query(
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

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(leagues)
				.set(updateData)
				.where(eq(leagues.id, id))
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

			if (updates.length === 0) return this.getById(id);

			updates.push('updated_at = ?');
			values.push(now);
			values.push(id);

			const query = `UPDATE leagues SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: string): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any).delete(leagues).where(eq(leagues.id, id)).returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM leagues WHERE id = ?', [
				id
			]);
			return result.meta.changes > 0;
		}
	}

	async toggleActive(id: string): Promise<League | null> {
		const league = await this.getById(id);
		if (!league) return null;

		const newStatus = league.isActive === 1 ? 0 : 1;

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(leagues)
				.set({
					isActive: newStatus,
					updatedAt: new Date().toISOString()
				})
				.where(eq(leagues.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE leagues SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *',
				[newStatus, new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async lock(id: string): Promise<League | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(leagues)
				.set({
					isLocked: 1,
					updatedAt: new Date().toISOString()
				})
				.where(eq(leagues.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE leagues SET is_locked = 1, updated_at = ? WHERE id = ? RETURNING *',
				[new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async unlock(id: string): Promise<League | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(leagues)
				.set({
					isLocked: 0,
					updatedAt: new Date().toISOString()
				})
				.where(eq(leagues.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE leagues SET is_locked = 0, updated_at = ? WHERE id = ? RETURNING *',
				[new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}
}
