// Roster operations - REST API only (raw SQL)
import type { D1RestClient } from '../d1-client.js';

// Roster type definition (matching database schema)
export interface Roster {
	id: number;
	teamId: number;
	userId: string;
	position: string | null;
	jerseyNumber: number | null;
	isCaptain: number;
	isCoCaptain: number;
	dateJoined: string;
	dateLeft: string | null;
	status: string;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

export class RosterOperations {
	constructor(private db: D1RestClient) {}

	async getAll(): Promise<Roster[]> {
		const result = await this.db.query('SELECT * FROM rosters ORDER BY created_at DESC');
		return result.results || [];
	}

	async getById(id: number): Promise<Roster | null> {
		const result = await this.db.query('SELECT * FROM rosters WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async getByTeamId(teamId: number): Promise<Roster[]> {
		const result = await this.db.query(
			'SELECT * FROM rosters WHERE team_id = ? ORDER BY is_captain DESC, is_co_captain DESC, date_joined DESC',
			[teamId]
		);
		return result.results || [];
	}

	async getByUserId(userId: string): Promise<Roster[]> {
		const result = await this.db.query(
			'SELECT * FROM rosters WHERE user_id = ? ORDER BY created_at DESC',
			[userId]
		);
		return result.results || [];
	}

	async getActiveByTeamId(teamId: number): Promise<Roster[]> {
		const result = await this.db.query(
			"SELECT * FROM rosters WHERE team_id = ? AND status = 'active' ORDER BY is_captain DESC, is_co_captain DESC, date_joined DESC",
			[teamId]
		);
		return result.results || [];
	}

	async getCaptainsByTeamId(teamId: number): Promise<Roster[]> {
		const result = await this.db.query(
			'SELECT * FROM rosters WHERE team_id = ? AND is_captain = 1 ORDER BY date_joined ASC',
			[teamId]
		);
		return result.results || [];
	}

	async create(data: {
		teamId: number;
		userId: string;
		position?: string;
		jerseyNumber?: number;
		isCaptain?: boolean;
		isCoCaptain?: boolean;
		status?: string;
		notes?: string;
	}): Promise<Roster> {
		const now = new Date().toISOString();

		const result = await this.db.query(
			'INSERT INTO rosters (team_id, user_id, position, jersey_number, is_captain, is_co_captain, date_joined, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
			[
				data.teamId,
				data.userId,
				data.position || null,
				data.jerseyNumber || null,
				data.isCaptain ? 1 : 0,
				data.isCoCaptain ? 1 : 0,
				now,
				data.status || 'active',
				data.notes || null,
				now,
				now
			]
		);
		return result.results[0];
	}

	async update(
		id: number,
		data: Partial<{
			position: string;
			jerseyNumber: number;
			isCaptain: boolean;
			isCoCaptain: boolean;
			dateLeft: string;
			status: string;
			notes: string;
		}>
	): Promise<Roster | null> {
		const now = new Date().toISOString();

		const updates: string[] = [];
		const values: (string | number)[] = [];

		Object.entries(data).forEach(([key, value]) => {
			if (value !== undefined) {
				const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
				if (key === 'isCaptain' || key === 'isCoCaptain') {
					updates.push(`${dbKey} = ?`);
					values.push(value ? 1 : 0);
				} else {
					updates.push(`${dbKey} = ?`);
					values.push(value as string | number);
				}
			}
		});

		if (updates.length === 0) return this.getById(id);

		updates.push('updated_at = ?');
		values.push(now);
		values.push(id);

		const query = `UPDATE rosters SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.db.query(query, values);
		return result.results?.[0] || null;
	}

	async delete(id: number): Promise<boolean> {
		const result = await this.db.query('DELETE FROM rosters WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async removeFromTeam(id: number): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db.query(
			'UPDATE rosters SET status = ?, date_left = ?, updated_at = ? WHERE id = ? RETURNING *',
			['inactive', now, now, id]
		);
		return result.results?.[0] || null;
	}

	async promoteToCaptain(id: number): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db.query(
			'UPDATE rosters SET is_captain = 1, updated_at = ? WHERE id = ? RETURNING *',
			[now, id]
		);
		return result.results?.[0] || null;
	}

	async promoteToCoCaptain(id: number): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db.query(
			'UPDATE rosters SET is_co_captain = 1, updated_at = ? WHERE id = ? RETURNING *',
			[now, id]
		);
		return result.results?.[0] || null;
	}
}
