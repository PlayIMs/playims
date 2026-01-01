// Sport operations - Drizzle ORM
import { eq, desc, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { sports, type Sport } from '../schema/index.js';

export class SportOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Sport[]> {
		return await this.db.select().from(sports).orderBy(asc(sports.name));
	}

	async getById(id: string): Promise<Sport | null> {
		const result = await this.db.select().from(sports).where(eq(sports.id, id));
		return result[0] || null;
	}

	async getBySlug(slug: string): Promise<Sport | null> {
		const result = await this.db.select().from(sports).where(eq(sports.slug, slug));
		return result[0] || null;
	}

	async getActive(): Promise<Sport[]> {
		return await this.db
			.select()
			.from(sports)
			.where(eq(sports.isActive, 1))
			.orderBy(asc(sports.name));
	}

	async getByClientId(clientId: string): Promise<Sport[]> {
		return await this.db
			.select()
			.from(sports)
			.where(eq(sports.clientId, clientId))
			.orderBy(asc(sports.name));
	}

	async create(data: {
		name: string;
		slug: string;
		type?: string;
		description?: string;
		minPlayers?: number;
		maxPlayers?: number;
		clientId?: string;
	}): Promise<Sport | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(sports)
			.values({
				id,
				name: data.name,
				slug: data.slug,
				type: data.type || null,
				description: data.description || null,
				minPlayers: data.minPlayers || null,
				maxPlayers: data.maxPlayers || null,
				clientId: data.clientId || null,
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
			type: string;
			description: string;
			minPlayers: number;
			maxPlayers: number;
			isActive: number;
			imageUrl: string;
			rulebookUrl: string;
		}>
	): Promise<Sport | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(sports)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(sports.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(sports).where(eq(sports.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string): Promise<Sport | null> {
		const sport = await this.getById(id);
		if (!sport) return null;

		const newStatus = sport.isActive === 1 ? 0 : 1;

		const result = await this.db
			.update(sports)
			.set({
				isActive: newStatus,
				updatedAt: new Date().toISOString()
			})
			.where(eq(sports.id, id))
			.returning();

		return result[0] || null;
	}
}
