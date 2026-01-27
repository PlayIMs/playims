// Team operations - Drizzle ORM
import { eq, desc, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { teams, type Team } from '../schema/index.js';

export class TeamOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Team[]> {
		return await this.db.select().from(teams).orderBy(desc(teams.createdAt));
	}

	async getById(id: string): Promise<Team | null> {
		const result = await this.db.select().from(teams).where(eq(teams.id, id));
		return result[0] || null;
	}

	async getBySlug(slug: string): Promise<Team | null> {
		const result = await this.db.select().from(teams).where(eq(teams.slug, slug));
		return result[0] || null;
	}

	async getByDivisionId(divisionId: string): Promise<Team[]> {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.divisionId, divisionId))
			.orderBy(asc(teams.name));
	}

	async getActive(): Promise<Team[]> {
		return await this.db
			.select()
			.from(teams)
			.where(eq(teams.isActive, 1))
			.orderBy(asc(teams.name));
	}

	async create(data: {
		clientId: string;
		divisionId: string;
		name: string;
		slug: string;
		description?: string;
		imageUrl?: string;
		teamStatus?: string;
		doesAcceptFreeAgents?: number;
		isAutoAcceptMembers?: number;
		currentRosterSize?: number;
		teamColor?: string;
		dateRegistered?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Team | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(teams)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				divisionId: data.divisionId,
				name: data.name,
				slug: data.slug,
				description: data.description || null,
				imageUrl: data.imageUrl || null,
				teamStatus: data.teamStatus || 'active',
				doesAcceptFreeAgents: data.doesAcceptFreeAgents ?? 0,
				isAutoAcceptMembers: data.isAutoAcceptMembers ?? 0,
				currentRosterSize: data.currentRosterSize ?? 0,
				teamColor: data.teamColor || null,
				dateRegistered: data.dateRegistered || now,
				isActive: 1,
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
			name: string;
			slug: string;
			description: string;
			imageUrl: string;
			teamStatus: string;
			doesAcceptFreeAgents: number;
			isAutoAcceptMembers: number;
			currentRosterSize: number;
			teamColor: string;
			dateRegistered: string;
			isActive: number;
			updatedUser: string;
		}>
	): Promise<Team | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(teams)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(teams.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(teams).where(eq(teams.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string): Promise<Team | null> {
		const team = await this.getById(id);
		if (!team) return null;

		const newStatus = team.isActive === 1 ? 0 : 1;

		const result = await this.db
			.update(teams)
			.set({
				isActive: newStatus,
				updatedAt: new Date().toISOString()
			})
			.where(eq(teams.id, id))
			.returning();

		return result[0] || null;
	}
}
