// Division operations - Works with both Drizzle (local) and REST API (production)
import { eq, asc } from 'drizzle-orm';
import { divisions, type Division } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class DivisionOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<Division[]> {
		if (this.isDrizzle) {
			return await (this.db as any).select().from(divisions).orderBy(asc(divisions.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM divisions ORDER BY name ASC'
			);
			return result.results || [];
		}
	}

	async getById(id: string): Promise<Division | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(divisions)
				.where(eq(divisions.id, id))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM divisions WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getBySlug(slug: string): Promise<Division | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(divisions)
				.where(eq(divisions.slug, slug))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM divisions WHERE slug = ?',
				[slug]
			);
			return result.results?.[0] || null;
		}
	}

	async getByLeagueId(leagueId: string): Promise<Division[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(divisions)
				.where(eq(divisions.leagueId, leagueId))
				.orderBy(asc(divisions.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM divisions WHERE league_id = ? ORDER BY name ASC',
				[leagueId]
			);
			return result.results || [];
		}
	}

	async getActive(): Promise<Division[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(divisions)
				.where(eq(divisions.isActive, 1))
				.orderBy(asc(divisions.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM divisions WHERE is_active = 1 ORDER BY name ASC'
			);
			return result.results || [];
		}
	}

	async getByDayOfWeek(dayOfWeek: string): Promise<Division[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(divisions)
				.where(eq(divisions.dayOfWeek, dayOfWeek))
				.orderBy(asc(divisions.gameTime));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM divisions WHERE day_of_week = ? ORDER BY game_time ASC',
				[dayOfWeek]
			);
			return result.results || [];
		}
	}

	async create(data: {
		leagueId: string;
		name: string;
		slug: string;
		description?: string;
		dayOfWeek?: string;
		gameTime?: string;
		maxTeams?: number;
		location?: string;
	}): Promise<Division> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(divisions)
				.values({
					id,
					leagueId: data.leagueId,
					name: data.name,
					slug: data.slug,
					description: data.description || null,
					dayOfWeek: data.dayOfWeek || null,
					gameTime: data.gameTime || null,
					maxTeams: data.maxTeams || null,
					location: data.location || null,
					isActive: 1,
					isLocked: 0,
					teamsCount: 0,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			return result[0];
		} else {
			const result = await (this.db as D1RestClient).query(
				'INSERT INTO divisions (id, league_id, name, slug, description, day_of_week, game_time, max_teams, location, is_active, is_locked, teams_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
				[
					id,
					data.leagueId,
					data.name,
					data.slug,
					data.description || null,
					data.dayOfWeek || null,
					data.gameTime || null,
					data.maxTeams || null,
					data.location || null,
					1,
					0,
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
			dayOfWeek: string;
			gameTime: string;
			maxTeams: number;
			location: string;
			isActive: number;
			isLocked: number;
			teamsCount: number;
			startDate: string;
		}>
	): Promise<Division | null> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(divisions)
				.set(updateData)
				.where(eq(divisions.id, id))
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

			const query = `UPDATE divisions SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: string): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.delete(divisions)
				.where(eq(divisions.id, id))
				.returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM divisions WHERE id = ?', [
				id
			]);
			return result.meta.changes > 0;
		}
	}

	async incrementTeamCount(id: string): Promise<Division | null> {
		const division = await this.getById(id);
		if (!division) return null;

		const newCount = (division.teamsCount || 0) + 1;

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(divisions)
				.set({
					teamsCount: newCount,
					updatedAt: new Date().toISOString()
				})
				.where(eq(divisions.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE divisions SET teams_count = ?, updated_at = ? WHERE id = ? RETURNING *',
				[newCount, new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async decrementTeamCount(id: string): Promise<Division | null> {
		const division = await this.getById(id);
		if (!division) return null;

		const newCount = Math.max((division.teamsCount || 0) - 1, 0);

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(divisions)
				.set({
					teamsCount: newCount,
					updatedAt: new Date().toISOString()
				})
				.where(eq(divisions.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE divisions SET teams_count = ?, updated_at = ? WHERE id = ? RETURNING *',
				[newCount, new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}
}
