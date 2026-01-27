// Roster operations - Drizzle ORM
import { eq, desc, asc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { rosters, type Roster } from '../schema/index.js';

export class RosterOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Roster[]> {
		return await this.db.select().from(rosters).orderBy(desc(rosters.createdAt));
	}

	async getById(id: string): Promise<Roster | null> {
		const result = await this.db.select().from(rosters).where(eq(rosters.id, id));
		return result[0] || null;
	}

	async getByTeamId(teamId: string): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.teamId, teamId))
			.orderBy(desc(rosters.isCaptain), desc(rosters.isCoCaptain), desc(rosters.dateJoined));
	}

	async getByUserId(userId: string): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.userId, userId))
			.orderBy(desc(rosters.createdAt));
	}

	async getActiveByTeamId(teamId: string): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(and(eq(rosters.teamId, teamId), eq(rosters.rosterStatus, 'active')))
			.orderBy(desc(rosters.isCaptain), desc(rosters.isCoCaptain), desc(rosters.dateJoined));
	}

	async getCaptainsByTeamId(teamId: string): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(and(eq(rosters.teamId, teamId), eq(rosters.isCaptain, 1)))
			.orderBy(asc(rosters.dateJoined));
	}

	async create(data: {
		clientId: string;
		teamId: string;
		userId: string;
		isCaptain?: boolean;
		isCoCaptain?: boolean;
		rosterStatus?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(rosters)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				teamId: data.teamId,
				userId: data.userId,
				isCaptain: data.isCaptain ? 1 : 0,
				isCoCaptain: data.isCoCaptain ? 1 : 0,
				rosterStatus: data.rosterStatus || 'active',
				dateJoined: now,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser || null,
				updatedUser: data.updatedUser || data.createdUser || null
			})
			.returning();

		return result[0] || null;
	}

	async update(
		id: string,
		data: Partial<{
			isCaptain: boolean;
			isCoCaptain: boolean;
			dateLeft: string;
			rosterStatus: string;
			updatedUser: string;
		}>
	): Promise<Roster | null> {
		const now = new Date().toISOString();
		
		// Map boolean to number for update
		const updateData: Record<string, unknown> = { ...data };
		if (data.isCaptain !== undefined) updateData.isCaptain = data.isCaptain ? 1 : 0;
		if (data.isCoCaptain !== undefined) updateData.isCoCaptain = data.isCoCaptain ? 1 : 0;

		const result = await this.db
			.update(rosters)
			.set({
				...updateData,
				updatedAt: now
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(rosters).where(eq(rosters.id, id)).returning();
		return result.length > 0;
	}

	async removeFromTeam(id: string): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(rosters)
			.set({
				rosterStatus: 'inactive',
				dateLeft: now,
				updatedAt: now
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async promoteToCaptain(id: string): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(rosters)
			.set({
				isCaptain: 1,
				updatedAt: now
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async promoteToCoCaptain(id: string): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(rosters)
			.set({
				isCoCaptain: 1,
				updatedAt: now
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}
}
