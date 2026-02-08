// Offering operations - Drizzle ORM
import { eq, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { offerings, type Offering } from '../schema/index.js';

export class OfferingOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(): Promise<Offering[]> {
		return await this.db.select().from(offerings).orderBy(asc(offerings.name));
	}

	async getById(id: string): Promise<Offering | null> {
		const result = await this.db.select().from(offerings).where(eq(offerings.id, id));
		return result[0] || null;
	}

	async getBySlug(slug: string): Promise<Offering | null> {
		const result = await this.db.select().from(offerings).where(eq(offerings.slug, slug));
		return result[0] || null;
	}

	async getActive(): Promise<Offering[]> {
		return await this.db
			.select()
			.from(offerings)
			.where(eq(offerings.isActive, 1))
			.orderBy(asc(offerings.name));
	}

	async getByClientId(clientId: string): Promise<Offering[]> {
		return await this.db
			.select()
			.from(offerings)
			.where(eq(offerings.clientId, clientId))
			.orderBy(asc(offerings.name));
	}

	async create(data: {
		name: string;
		slug: string;
		type?: string;
		description?: string;
		minPlayers?: number;
		maxPlayers?: number;
		clientId?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Offering | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(offerings)
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
			type: string;
			description: string;
			minPlayers: number;
			maxPlayers: number;
			isActive: number;
			imageUrl: string;
			rulebookUrl: string;
			updatedUser: string;
		}>
	): Promise<Offering | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(offerings)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(offerings.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(offerings).where(eq(offerings.id, id)).returning();
		return result.length > 0;
	}

	async toggleActive(id: string): Promise<Offering | null> {
		const offering = await this.getById(id);
		if (!offering) return null;

		const newStatus = offering.isActive === 1 ? 0 : 1;

		const result = await this.db
			.update(offerings)
			.set({
				isActive: newStatus,
				updatedAt: new Date().toISOString()
			})
			.where(eq(offerings.id, id))
			.returning();

		return result[0] || null;
	}
}
