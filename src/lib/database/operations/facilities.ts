// Facility operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { facilities, type Facility } from '../schema/index.js';

export class FacilityOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId: string): Promise<Facility[]> {
		return await this.db
			.select()
			.from(facilities)
			.where(eq(facilities.clientId, clientId))
			.orderBy(desc(facilities.createdAt));
	}

	async getById(id: string): Promise<Facility | null> {
		const result = await this.db.select().from(facilities).where(eq(facilities.id, id));
		return result[0] || null;
	}

	async create(data: {
		clientId: string;
		name: string;
		slug: string;
		addressLine1?: string;
		addressLine2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
		timezone?: string;
		capacity?: number | null;
		description?: string;
		metadata?: string;
		isActive?: number;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Facility | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(facilities)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				name: data.name,
				slug: data.slug,
				addressLine1: data.addressLine1 || null,
				addressLine2: data.addressLine2 || null,
				city: data.city || null,
				state: data.state || null,
				postalCode: data.postalCode || null,
				country: data.country || null,
				timezone: data.timezone || null,
				capacity: data.capacity ?? null,
				description: data.description || null,
				metadata: data.metadata || null,
				isActive: data.isActive ?? 1,
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
			addressLine1: string;
			addressLine2: string;
			city: string;
			state: string;
			postalCode: string;
			country: string;
			timezone: string;
			capacity: number | null;
			description: string;
			metadata: string;
			isActive: number;
			updatedUser: string;
		}>
	): Promise<Facility | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(facilities)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(facilities.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(facilities).where(eq(facilities.id, id)).returning();
		return result.length > 0;
	}
}
