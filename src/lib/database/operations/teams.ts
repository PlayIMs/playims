// Team operations - Works with both Drizzle (local) and REST API (production)
import { eq, desc, asc } from 'drizzle-orm';
import { teams, type Team } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class TeamOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<Team[]> {
		if (this.isDrizzle) {
			return await (this.db as any).select().from(teams).orderBy(desc(teams.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM teams ORDER BY created_at DESC'
			);
			return result.results || [];
		}
	}

	async getById(id: number): Promise<Team | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any).select().from(teams).where(eq(teams.id, id)).limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM teams WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getBySlug(slug: string): Promise<Team | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(teams)
				.where(eq(teams.slug, slug))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM teams WHERE slug = ?', [
				slug
			]);
			return result.results?.[0] || null;
		}
	}

	async getByClientId(clientId: number): Promise<Team[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(teams)
				.where(eq(teams.clientId, clientId))
				.orderBy(asc(teams.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM teams WHERE client_id = ? ORDER BY name ASC',
				[clientId]
			);
			return result.results || [];
		}
	}

	async getByDivisionId(divisionId: number): Promise<Team[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(teams)
				.where(eq(teams.divisionId, divisionId))
				.orderBy(asc(teams.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM teams WHERE division_id = ? ORDER BY name ASC',
				[divisionId]
			);
			return result.results || [];
		}
	}

	async getByStatus(status: string): Promise<Team[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(teams)
				.where(eq(teams.teamStatus, status))
				.orderBy(desc(teams.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM teams WHERE team_status = ? ORDER BY created_at DESC',
				[status]
			);
			return result.results || [];
		}
	}

	async getAcceptingFreeAgents(): Promise<Team[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(teams)
				.where(eq(teams.doesAcceptFreeAgents, 1))
				.orderBy(asc(teams.name));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM teams WHERE does_accept_free_agents = 1 ORDER BY name ASC'
			);
			return result.results || [];
		}
	}

	async create(data: {
		clientId: number;
		divisionId: number;
		name: string;
		slug: string;
		teamStatus?: string;
		description?: string;
		imageUrl?: string;
		teamColor?: string;
	}): Promise<Team> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(teams)
				.values({
					clientId: data.clientId,
					divisionId: data.divisionId,
					name: data.name,
					slug: data.slug,
					teamStatus: data.teamStatus || 'pending',
					description: data.description || null,
					imageUrl: data.imageUrl || null,
					teamColor: data.teamColor || null,
					doesAcceptFreeAgents: 0,
					isAutoAcceptMembers: 0,
					currentRosterSize: 0,
					dateRegistered: now,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			return result[0];
		} else {
			const result = await (this.db as D1RestClient).query(
				'INSERT INTO teams (client_id, division_id, name, slug, team_status, description, image_url, team_color, does_accept_free_agents, is_auto_accept_members, current_roster_size, date_registered, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
				[
					data.clientId,
					data.divisionId,
					data.name,
					data.slug,
					data.teamStatus || 'pending',
					data.description || null,
					data.imageUrl || null,
					data.teamColor || null,
					0,
					0,
					0,
					now,
					now,
					now
				]
			);
			return result.results[0];
		}
	}

	async update(
		id: number,
		data: Partial<{
			name: string;
			slug: string;
			description: string;
			imageUrl: string;
			teamStatus: string;
			teamColor: string;
			doesAcceptFreeAgents: number;
			isAutoAcceptMembers: number;
		}>
	): Promise<Team | null> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(teams)
				.set(updateData)
				.where(eq(teams.id, id))
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

			const query = `UPDATE teams SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: number): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any).delete(teams).where(eq(teams.id, id)).returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM teams WHERE id = ?', [id]);
			return result.meta.changes > 0;
		}
	}

	async updateRosterSize(id: number, size: number): Promise<Team | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(teams)
				.set({
					currentRosterSize: size,
					updatedAt: new Date().toISOString()
				})
				.where(eq(teams.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE teams SET current_roster_size = ?, updated_at = ? WHERE id = ? RETURNING *',
				[size, new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async incrementRosterSize(id: number): Promise<Team | null> {
		const team = await this.getById(id);
		if (!team) return null;
		return await this.updateRosterSize(id, team.currentRosterSize + 1);
	}

	async decrementRosterSize(id: number): Promise<Team | null> {
		const team = await this.getById(id);
		if (!team) return null;
		return await this.updateRosterSize(id, Math.max(team.currentRosterSize - 1, 0));
	}

	async toggleFreeAgents(id: number): Promise<Team | null> {
		const team = await this.getById(id);
		if (!team) return null;

		const newStatus = team.doesAcceptFreeAgents === 1 ? 0 : 1;

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(teams)
				.set({
					doesAcceptFreeAgents: newStatus,
					updatedAt: new Date().toISOString()
				})
				.where(eq(teams.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE teams SET does_accept_free_agents = ?, updated_at = ? WHERE id = ? RETURNING *',
				[newStatus, new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}
}
