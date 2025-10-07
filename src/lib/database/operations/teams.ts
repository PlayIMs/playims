// Team operations - CRUD methods for teams table
import { eq, desc, asc } from 'drizzle-orm';
import { teams, type Team, type NewTeam } from '../schema.js';

export class TeamOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(teams).orderBy(desc(teams.createdAt));
	}

	async getById(id: number) {
		const result = await this.db.select().from(teams).where(eq(teams.id, id)).limit(1);
		return result[0] || null;
	}

	async getBySlug(slug: string) {
		const result = await this.db.select().from(teams).where(eq(teams.slug, slug)).limit(1);
		return result[0] || null;
	}

	async getByClientId(clientId: number) {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.clientId, clientId))
			.orderBy(asc(teams.name));
	}

	async getByDivisionId(divisionId: number) {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.divisionId, divisionId))
			.orderBy(asc(teams.name));
	}

	async getByStatus(status: string) {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.teamStatus, status))
			.orderBy(desc(teams.createdAt));
	}

	async getAcceptingFreeAgents() {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.doesAcceptFreeAgents, 1))
			.orderBy(asc(teams.name));
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
	}) {
		const now = new Date().toISOString();
		const result = await this.db
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
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db.update(teams).set(updateData).where(eq(teams.id, id)).returning();

		return result[0] || null;
	}

	async delete(id: number) {
		const result = await this.db.delete(teams).where(eq(teams.id, id)).returning();
		return result.length > 0;
	}

	async updateRosterSize(id: number, size: number) {
		const result = await this.db
			.update(teams)
			.set({
				currentRosterSize: size,
				updatedAt: new Date().toISOString()
			})
			.where(eq(teams.id, id))
			.returning();

		return result[0] || null;
	}

	async incrementRosterSize(id: number) {
		const team = await this.getById(id);
		if (!team) return null;

		return await this.updateRosterSize(id, team.currentRosterSize + 1);
	}

	async decrementRosterSize(id: number) {
		const team = await this.getById(id);
		if (!team) return null;

		return await this.updateRosterSize(id, Math.max(team.currentRosterSize - 1, 0));
	}

	async toggleFreeAgents(id: number) {
		const team = await this.getById(id);
		if (!team) return null;

		const result = await this.db
			.update(teams)
			.set({
				doesAcceptFreeAgents: team.doesAcceptFreeAgents === 1 ? 0 : 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(teams.id, id))
			.returning();

		return result[0] || null;
	}
}
