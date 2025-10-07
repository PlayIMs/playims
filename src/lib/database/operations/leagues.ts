// League operations - CRUD methods for leagues table
import { eq, desc, and } from 'drizzle-orm';
import { leagues, type League, type NewLeague } from '../schema.js';

export class LeagueOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(leagues).orderBy(desc(leagues.createdAt));
	}

	async getById(id: string) {
		const result = await this.db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
		return result[0] || null;
	}

	async getBySlug(slug: string) {
		const result = await this.db.select().from(leagues).where(eq(leagues.slug, slug)).limit(1);
		return result[0] || null;
	}

	async getByClientId(clientId: string) {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.clientId, clientId))
			.orderBy(desc(leagues.year), desc(leagues.createdAt));
	}

	async getBySportId(sportId: string) {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.sportId, sportId))
			.orderBy(desc(leagues.year));
	}

	async getActive() {
		return await this.db
			.select()
			.from(leagues)
			.where(eq(leagues.isActive, 1))
			.orderBy(desc(leagues.seasonStartDate));
	}

	async getByYearAndSeason(year: number, season: string) {
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
	}) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(leagues)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				sportId: data.sportId,
				name: data.name,
				slug: data.slug,
				year: data.year || new Date().getFullYear(),
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

		return result[0];
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
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(leagues)
			.set(updateData)
			.where(eq(leagues.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string) {
		const result = await this.db.delete(leagues).where(eq(leagues.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string) {
		const league = await this.getById(id);
		if (!league) return null;

		const result = await this.db
			.update(leagues)
			.set({
				isActive: league.isActive === 1 ? 0 : 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(leagues.id, id))
			.returning();

		return result[0] || null;
	}

	async lock(id: string) {
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

	async unlock(id: string) {
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
