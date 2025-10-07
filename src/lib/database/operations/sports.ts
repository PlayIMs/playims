// Sport operations - CRUD methods for sports table
import { eq, desc, asc } from 'drizzle-orm';
import { sports, type Sport, type NewSport } from '../schema.js';

export class SportOperations {
	constructor(private db: ReturnType<typeof import('../drizzle.js').createDrizzleClient>) {}

	async getAll() {
		return await this.db.select().from(sports).orderBy(asc(sports.name));
	}

	async getById(id: string) {
		const result = await this.db.select().from(sports).where(eq(sports.id, id)).limit(1);
		return result[0] || null;
	}

	async getBySlug(slug: string) {
		const result = await this.db.select().from(sports).where(eq(sports.slug, slug)).limit(1);
		return result[0] || null;
	}

	async getActive() {
		return await this.db
			.select()
			.from(sports)
			.where(eq(sports.isActive, 1))
			.orderBy(asc(sports.name));
	}

	async getByClientId(clientId: string) {
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
	}) {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(sports)
			.values({
				id: crypto.randomUUID(),
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

		return result[0];
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
	) {
		const updateData = {
			...data,
			updatedAt: new Date().toISOString()
		};

		const result = await this.db
			.update(sports)
			.set(updateData)
			.where(eq(sports.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string) {
		const result = await this.db.delete(sports).where(eq(sports.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string) {
		const sport = await this.getById(id);
		if (!sport) return null;

		const result = await this.db
			.update(sports)
			.set({
				isActive: sport.isActive === 1 ? 0 : 1,
				updatedAt: new Date().toISOString()
			})
			.where(eq(sports.id, id))
			.returning();

		return result[0] || null;
	}
}
