// League operations - Drizzle ORM
import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { leagues, type League } from '../schema/index.js';

export class LeagueOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<League[]> {
		return await this.db.select().from(leagues).orderBy(desc(leagues.createdAt));
	}

	async getById(id: string): Promise<League | null> {
		const result = await this.db.select().from(leagues).where(eq(leagues.id, id));
		return result[0] || null;
	}

	async getBySlug(slug: string): Promise<League | null> {
		const result = await this.db.select().from(leagues).where(eq(leagues.slug, slug));
		return result[0] || null;
	}

	async getByClientId(clientId: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.clientId, clientId))
			.orderBy(desc(leagues.year), desc(leagues.createdAt));
	}

	async getBySportId(sportId: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.sportId, sportId))
			.orderBy(desc(leagues.year));
	}

	async getActive(): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.isActive, 1))
			.orderBy(desc(leagues.seasonStartDate));
	}

	async getByYearAndSeason(year: number, season: string): Promise<League[]> {
		return await this.db
			.select()
			.from(leagues)
			.where(and(eq(leagues.year, year), eq(leagues.season, season)))
			.orderBy(desc(leagues.createdAt));
	}

	async create(data: {
		clientId: string;
		sportId: string;
		name: string;
		slug: string;
		year?: number;
		season?: string;
		description?: string;
		gender?: string;
		skillLevel?: string;
	}): Promise<League | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();
		const year = data.year || new Date().getFullYear();

		const result = await this.db
			.insert(leagues)
			.values({
				id,
				clientId: data.clientId,
				sportId: data.sportId,
				name: data.name,
				slug: data.slug,
				year,
				season: data.season || null,
				description: data.description || null,
				gender: data.gender || null,
				skillLevel: data.skillLevel || null,
				isActive: 1,
				isLocked: 0,
				createdAt: now,
				updatedAt: now
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
			year: number;
			season: string;
			gender: string;
			skillLevel: string;
			regStartDate: string;
			regEndDate: string;
			seasonStartDate: string;
			seasonEndDate: string;
			isActive: number;
			isLocked: number;
		}>
	): Promise<League | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(leagues)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(leagues.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(leagues).where(eq(leagues.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string): Promise<League | null> {
		const league = await this.getById(id);
		if (!league) return null;

		const newStatus = league.isActive === 1 ? 0 : 1;

		const result = await this.db
			.update(leagues)
			.set({
				isActive: newStatus,
				updatedAt: new Date().toISOString()
			})
			.where(eq(leagues.id, id))
			.returning();

		return result[0] || null;
	}

	async lock(id: string): Promise<League | null> {
		const result = await this.db
			.update(leagues)
			.set({
				isLocked: 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(leagues.id, id))
			.returning();

		return result[0] || null;
	}

	async unlock(id: string): Promise<League | null> {
		const result = await this.db
			.update(leagues)
			.set({
				isLocked: 0,
				updatedAt: new Date().toISOString()
			})
			.where(eq(leagues.id, id))
			.returning();

		return result[0] || null;
	}
}
