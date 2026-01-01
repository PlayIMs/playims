// Division operations - Drizzle ORM
import { eq, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { divisions, type Division } from '../schema/index.js';

export class DivisionOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Division[]> {
		return await this.db.select().from(divisions).orderBy(asc(divisions.name));
	}

	async getById(id: string): Promise<Division | null> {
		const result = await this.db.select().from(divisions).where(eq(divisions.id, id));
		return result[0] || null;
	}

	async getBySlug(slug: string): Promise<Division | null> {
		const result = await this.db.select().from(divisions).where(eq(divisions.slug, slug));
		return result[0] || null;
	}

	async getByLeagueId(leagueId: string): Promise<Division[]> {
		return await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.leagueId, leagueId))
			.orderBy(asc(divisions.name));
	}

	async getActive(): Promise<Division[]> {
		return await this.db
			.select()
			.from(divisions)
			.where(eq(divisions.isActive, 1))
			.orderBy(asc(divisions.name));
	}

	async create(data: {
		leagueId: string;
		name: string;
		slug: string;
		description?: string;
		maxTeams?: number;
	}): Promise<Division | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(divisions)
			.values({
				id,
				leagueId: data.leagueId,
				name: data.name,
				slug: data.slug,
				description: data.description || null,
				maxTeams: data.maxTeams || null,
				isActive: 1,
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
			maxTeams: number;
			isActive: number;
		}>
	): Promise<Division | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(divisions)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(divisions.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(divisions).where(eq(divisions.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string): Promise<Division | null> {
		const division = await this.getById(id);
		if (!division) return null;

		const newStatus = division.isActive === 1 ? 0 : 1;

		const result = await this.db
			.update(divisions)
			.set({
				isActive: newStatus,
				updatedAt: new Date().toISOString()
			})
			.where(eq(divisions.id, id))
			.returning();

		return result[0] || null;
	}
}
