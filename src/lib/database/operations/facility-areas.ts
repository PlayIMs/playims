// Facility area operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { facilityAreas, type FacilityArea } from '../schema/index.js';

export class FacilityAreaOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId: string): Promise<FacilityArea[]> {
		return await this.db
			.select()
			.from(facilityAreas)
			.where(eq(facilityAreas.clientId, clientId))
			.orderBy(desc(facilityAreas.createdAt));
	}

	async getById(id: string): Promise<FacilityArea | null> {
		const result = await this.db.select().from(facilityAreas).where(eq(facilityAreas.id, id));
		return result[0] || null;
	}

	async getByFacilityId(facilityId: string): Promise<FacilityArea[]> {
		return await this.db
			.select()
			.from(facilityAreas)
			.where(eq(facilityAreas.facilityId, facilityId))
			.orderBy(desc(facilityAreas.createdAt));
	}

	async create(data: {
		clientId: string;
		facilityId: string;
		name: string;
		slug?: string;
		description?: string;
		isActive?: number;
		metadata?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<FacilityArea | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(facilityAreas)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				facilityId: data.facilityId,
				name: data.name,
				slug: data.slug || null,
				description: data.description || null,
				isActive: data.isActive ?? 1,
				metadata: data.metadata || null,
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
			facilityId: string;
			name: string;
			slug: string;
			description: string | null;
			isActive: number;
			metadata: string;
			updatedUser: string;
		}>
	): Promise<FacilityArea | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(facilityAreas)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(facilityAreas.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(facilityAreas).where(eq(facilityAreas.id, id)).returning();
		return result.length > 0;
	}
}
