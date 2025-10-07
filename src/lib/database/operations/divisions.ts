// Division operations - CRUD methods for divisions table
import { eq, asc } from 'drizzle-orm';
import { divisions, type Division, type NewDivision } from '../schema.js';

export class DivisionOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(divisions).orderBy(asc(divisions.name));
	}

	async getById(id: string) {
		const result = await this.db.select().from(divisions).where(eq(divisions.id, id)).limit(1);
		return result[0] || null;
	}

	async getBySlug(slug: string) {
		const result = await this.db.select().from(divisions).where(eq(divisions.slug, slug)).limit(1);
		return result[0] || null;
	}

	async getByLeagueId(leagueId: string) {
		return await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.leagueId, leagueId))
			.orderBy(asc(divisions.name));
	}

	async getActive() {
		return await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.isActive, 1))
			.orderBy(asc(divisions.name));
	}

	async getByDayOfWeek(dayOfWeek: string) {
		return await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.dayOfWeek, dayOfWeek))
			.orderBy(asc(divisions.gameTime));
	}

	async create(data: {
		leagueId: string;
		name: string;
		slug: string;
		description?: string;
		dayOfWeek?: string;
		gameTime?: string;
		maxTeams?: number;
		location?: string;
	}) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(divisions)
			.values({
				id: crypto.randomUUID(),
				leagueId: data.leagueId,
				name: data.name,
				slug: data.slug,
				description: data.description || null,
				dayOfWeek: data.dayOfWeek || null,
				gameTime: data.gameTime || null,
				maxTeams: data.maxTeams || null,
				location: data.location || null,
				isActive: 1,
				isLocked: 0,
				teamsCount: 0,
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
			dayOfWeek: string;
			gameTime: string;
			maxTeams: number;
			location: string;
			isActive: number;
			isLocked: number;
			teamsCount: number;
			startDate: string;
		}>
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(divisions)
			.set(updateData)
			.where(eq(divisions.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string) {
		const result = await this.db.delete(divisions).where(eq(divisions.id, id)).returning();
		return result.length > 0;
	}

	async incrementTeamCount(id: string) {
		const division = await this.getById(id);
		if (!division) return null;

		const result = await this.db
			.update(divisions)
			.set({
				teamsCount: (division.teamsCount || 0) + 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(divisions.id, id))
			.returning();

		return result[0] || null;
	}

	async decrementTeamCount(id: string) {
		const division = await this.getById(id);
		if (!division) return null;

		const result = await this.db
			.update(divisions)
			.set({
				teamsCount: Math.max((division.teamsCount || 0) - 1, 0),
				updatedAt: new Date().toISOString()
			})
			.where(eq(divisions.id, id))
			.returning();

		return result[0] || null;
	}
}
