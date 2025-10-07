// Roster operations - CRUD methods for rosters table
import { eq, desc, and } from 'drizzle-orm';
import { rosters, type Roster, type NewRoster } from '../schema.js';

export class RosterOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(rosters).orderBy(desc(rosters.createdAt));
	}

	async getById(id: number) {
		const result = await this.db.select().from(rosters).where(eq(rosters.id, id)).limit(1);
		return result[0] || null;
	}

	async getByTeamId(teamId: number) {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.teamId, teamId))
			.orderBy(desc(rosters.isCaptain), desc(rosters.isCoCaptain), desc(rosters.dateJoined));
	}

	async getByUserId(userId: number) {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.userId, userId))
			.orderBy(desc(rosters.createdAt));
	}

	async getByClientId(clientId: number) {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.clientId, clientId))
			.orderBy(desc(rosters.createdAt));
	}

	async getByStatus(status: string) {
		return await this.db
			.select()
			.from(rosters)
			.where(eq(rosters.rosterStatus, status))
			.orderBy(desc(rosters.createdAt));
	}

	async getTeamCaptain(teamId: number) {
		const result = await this.db
			.select()
			.from(rosters)
			.where(and(eq(rosters.teamId, teamId), eq(rosters.isCaptain, 1)))
			.limit(1);

		return result[0] || null;
	}

	async create(data: {
		clientId: number;
		teamId: number;
		userId: number;
		rosterStatus?: string;
		isCaptain?: boolean;
		isCoCaptain?: boolean;
	}) {
		const now = new Date().toISOString();
		const result = await this.db
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
	}

	async update(
		id: number,
		data: Partial<{
			rosterStatus: string;
			isCaptain: number;
			isCoCaptain: number;
		}>
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(rosters)
			.set(updateData)
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: number) {
		const result = await this.db.delete(rosters).where(eq(rosters.id, id)).returning();
		return result.length > 0;
	}

	async setCaptain(id: number) {
		const result = await this.db
			.update(rosters)
			.set({
				isCaptain: 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async removeCaptain(id: number) {
		const result = await this.db
			.update(rosters)
			.set({
				isCaptain: 0,
				updatedAt: new Date().toISOString()
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async setCoCaptain(id: number) {
		const result = await this.db
			.update(rosters)
			.set({
				isCoCaptain: 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(rosters.id, id))
			.returning();

		return result[0] || null;
	}

	async checkExists(userId: number, teamId: number) {
		const result = await this.db
			.select()
			.from(rosters)
			.where(and(eq(rosters.userId, userId), eq(rosters.teamId, teamId)))
			.limit(1);

		return result[0] || null;
	}
}
