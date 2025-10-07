// Sport operations - Works with both Drizzle (local) and REST API (production)
import { eq, asc } from 'drizzle-orm';
import { sports, type Sport } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class SportOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<Sport[]> {
		if (this.isDrizzle) {
			return await (this.db as any).select().from(sports).orderBy(asc(sports.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM sports ORDER BY name ASC'
			);
			return result.results || [];
		}
	}

	async getById(id: string): Promise<Sport | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any).select().from(sports).where(eq(sports.id, id)).limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM sports WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getBySlug(slug: string): Promise<Sport | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(sports)
				.where(eq(sports.slug, slug))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM sports WHERE slug = ?', [
				slug
			]);
			return result.results?.[0] || null;
		}
	}

	async getActive(): Promise<Sport[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(sports)
				.where(eq(sports.isActive, 1))
				.orderBy(asc(sports.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM sports WHERE is_active = 1 ORDER BY name ASC'
			);
			return result.results || [];
		}
	}

	async getByClientId(clientId: string): Promise<Sport[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(sports)
				.where(eq(sports.clientId, clientId))
				.orderBy(asc(sports.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM sports WHERE client_id = ? ORDER BY name ASC',
				[clientId]
			);
			return result.results || [];
		}
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

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(sports)
				.values({
					id,
					name: data.name,
					slug: data.slug,
					type: data.type || null,
					description: data.description || null,
					minPlayers: data.minPlayers || null,
					maxPlayers: data.maxPlayers || null,
					clientId: data.clientId || null,
					isActive: 1,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			return result[0];
		} else {
			const result = await (this.db as D1RestClient).query(
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

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(sports)
				.set(updateData)
				.where(eq(sports.id, id))
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

			const query = `UPDATE sports SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: string): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any).delete(sports).where(eq(sports.id, id)).returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM sports WHERE id = ?', [id]);
			return result.meta.changes > 0;
		}
	}

	async toggleActive(id: string): Promise<Sport | null> {
		const sport = await this.getById(id);
		if (!sport) return null;

		const newStatus = sport.isActive === 1 ? 0 : 1;

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(sports)
				.set({
					isActive: newStatus,
					updatedAt: new Date().toISOString()
				})
				.where(eq(sports.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE sports SET is_active = ?, updated_at = ? WHERE id = ? RETURNING *',
				[newStatus, new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}
}
