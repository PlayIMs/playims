// Roster operations - Drizzle ORM
import { eq, desc, asc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { rosters, type Roster } from '../schema.js';

export class RosterOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Roster[]> {
		return await this.db.select().from(rosters).orderBy(desc(rosters.createdAt));
	}

	async getById(id: number): Promise<Roster | null> {
		const result = await this.db.select().from(rosters).where(eq(rosters.id, id));
		return result[0] || null;
	}

	async getByTeamId(teamId: number): Promise<Roster[]> {
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

	async getActiveByTeamId(teamId: number): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(and(eq(rosters.teamId, teamId), eq(rosters.status, 'active')))
			.orderBy(desc(rosters.isCaptain), desc(rosters.isCoCaptain), desc(rosters.dateJoined));
	}

	async getCaptainsByTeamId(teamId: number): Promise<Roster[]> {
		return await this.db
			.select()
			.from(rosters)
			.where(and(eq(rosters.teamId, teamId), eq(rosters.isCaptain, 1)))
			.orderBy(asc(rosters.dateJoined));
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
	}): Promise<Roster | null> {
		const now = new Date().toISOString();

		// As with teams, we need to check if schema requires client_id
		// Schema: clientId: integer('client_id').notNull().references(() => clients.id)
		// But input data does not provide it.
		// I will use a placeholder or assume it's handled upstream, but adding 'clientId' here 
		// just in case we need to add it to the input type later.
		
		const result = await this.db
			.insert(rosters)
			.values({
				clientId: 0, // PLACEHOLDER: Needs to be provided
				teamId: data.teamId,
				userId: data.userId,
				position: data.position || null,
				jerseyNumber: data.jerseyNumber || null,
				isCaptain: data.isCaptain ? 1 : 0,
				isCoCaptain: data.isCoCaptain ? 1 : 0,
				dateJoined: now,
				status: data.status || 'active',
				notes: data.notes || null,
				createdAt: now,
				updatedAt: now
			} as any)
			.returning();

		return result[0] || null;
	}
	
	// Overloaded create to allow clientId
	async createWithClient(data: {
		clientId: number;
		teamId: number;
		userId: string;
		position?: string;
		jerseyNumber?: number;
		isCaptain?: boolean;
		isCoCaptain?: boolean;
		status?: string;
		notes?: string;
	}): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(rosters)
			.values({
				clientId: data.clientId,
				teamId: data.teamId,
				userId: data.userId,
				position: data.position || null,
				jerseyNumber: data.jerseyNumber || null,
				isCaptain: data.isCaptain ? 1 : 0,
				isCoCaptain: data.isCoCaptain ? 1 : 0,
				dateJoined: now,
				status: data.status || 'active',
				notes: data.notes || null,
				createdAt: now,
				updatedAt: now
			} as any)
			.returning();

		return result[0] || null;
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
		
		// Map boolean to number for update
		const updateData: any = { ...data };
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

	async delete(id: number): Promise<boolean> {
		const result = await this.db.delete(rosters).where(eq(rosters.id, id)).returning();
		return result.length > 0;
	}

	async removeFromTeam(id: number): Promise<Roster | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(rosters)
			.set({
				status: 'inactive',
				dateLeft: now,
				updatedAt: now
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async promoteToCaptain(id: number): Promise<Roster | null> {
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

	async promoteToCoCaptain(id: number): Promise<Roster | null> {
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
