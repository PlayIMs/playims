// Roster operations - Works with both Drizzle (local) and REST API (production)
import { eq, desc, and } from 'drizzle-orm';
import { rosters, type Roster } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class RosterOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<Roster[]> {
		if (this.isDrizzle) {
			return await (this.db as any).select().from(rosters).orderBy(desc(rosters.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters ORDER BY created_at DESC'
			);
			return result.results || [];
		}
	}

	async getById(id: number): Promise<Roster | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(rosters)
				.where(eq(rosters.id, id))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM rosters WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getByTeamId(teamId: number): Promise<Roster[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(rosters)
				.where(eq(rosters.teamId, teamId))
				.orderBy(desc(rosters.isCaptain), desc(rosters.isCoCaptain), desc(rosters.dateJoined));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters WHERE team_id = ? ORDER BY is_captain DESC, is_co_captain DESC, date_joined DESC',
				[teamId]
			);
			return result.results || [];
		}
	}

	async getByUserId(userId: number): Promise<Roster[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(rosters)
				.where(eq(rosters.userId, userId))
				.orderBy(desc(rosters.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters WHERE user_id = ? ORDER BY created_at DESC',
				[userId]
			);
			return result.results || [];
		}
	}

	async getByClientId(clientId: number): Promise<Roster[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(rosters)
				.where(eq(rosters.clientId, clientId))
				.orderBy(desc(rosters.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters WHERE client_id = ? ORDER BY created_at DESC',
				[clientId]
			);
			return result.results || [];
		}
	}

	async getByStatus(status: string): Promise<Roster[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(rosters)
				.where(eq(rosters.rosterStatus, status))
				.orderBy(desc(rosters.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters WHERE roster_status = ? ORDER BY created_at DESC',
				[status]
			);
			return result.results || [];
		}
	}

	async getTeamCaptain(teamId: number): Promise<Roster | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(rosters)
				.where(and(eq(rosters.teamId, teamId), eq(rosters.isCaptain, 1)))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters WHERE team_id = ? AND is_captain = 1 LIMIT 1',
				[teamId]
			);
			return result.results?.[0] || null;
		}
	}

	async create(data: {
		clientId: number;
		teamId: number;
		userId: number;
		rosterStatus?: string;
		isCaptain?: boolean;
		isCoCaptain?: boolean;
	}): Promise<Roster> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(rosters)
				.values({
					clientId: data.clientId,
					teamId: data.teamId,
					userId: data.userId,
					rosterStatus: data.rosterStatus || 'active',
					isCaptain: data.isCaptain ? 1 : 0,
					isCoCaptain: data.isCoCaptain ? 1 : 0,
					dateJoined: now,
					createdAt: now,
					updatedAt: now
				})
				.returning();
			return result[0];
		} else {
			const result = await (this.db as D1RestClient).query(
				'INSERT INTO rosters (client_id, team_id, user_id, roster_status, is_captain, is_co_captain, date_joined, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
				[
					data.clientId,
					data.teamId,
					data.userId,
					data.rosterStatus || 'active',
					data.isCaptain ? 1 : 0,
					data.isCoCaptain ? 1 : 0,
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
			rosterStatus: string;
			isCaptain: number;
			isCoCaptain: number;
		}>
	): Promise<Roster | null> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(rosters)
				.set(updateData)
				.where(eq(rosters.id, id))
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

			const query = `UPDATE rosters SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: number): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any).delete(rosters).where(eq(rosters.id, id)).returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM rosters WHERE id = ?', [
				id
			]);
			return result.meta.changes > 0;
		}
	}

	async setCaptain(id: number): Promise<Roster | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(rosters)
				.set({
					isCaptain: 1,
					updatedAt: new Date().toISOString()
				})
				.where(eq(rosters.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE rosters SET is_captain = 1, updated_at = ? WHERE id = ? RETURNING *',
				[new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async removeCaptain(id: number): Promise<Roster | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(rosters)
				.set({
					isCaptain: 0,
					updatedAt: new Date().toISOString()
				})
				.where(eq(rosters.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE rosters SET is_captain = 0, updated_at = ? WHERE id = ? RETURNING *',
				[new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async setCoCaptain(id: number): Promise<Roster | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.update(rosters)
				.set({
					isCoCaptain: 1,
					updatedAt: new Date().toISOString()
				})
				.where(eq(rosters.id, id))
				.returning();
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'UPDATE rosters SET is_co_captain = 1, updated_at = ? WHERE id = ? RETURNING *',
				[new Date().toISOString(), id]
			);
			return result.results?.[0] || null;
		}
	}

	async checkExists(userId: number, teamId: number): Promise<Roster | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(rosters)
				.where(and(eq(rosters.userId, userId), eq(rosters.teamId, teamId)))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM rosters WHERE user_id = ? AND team_id = ? LIMIT 1',
				[userId, teamId]
			);
			return result.results?.[0] || null;
		}
	}
}
