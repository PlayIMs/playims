// Facility area operations - Drizzle ORM
import { and, asc, desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { facilities, facilityAreas, type FacilityArea } from '../schema/index.js';
import { buildSearchRelevanceExpression, buildSearchTokenClauses } from './search-helpers.js';

export interface FacilityAreaSearchRow extends FacilityArea {
	facilityName: string | null;
}

export class FacilityAreaOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId: string): Promise<FacilityArea[]> {
		return await this.db
			.select()
			.from(facilityAreas)
			.where(eq(facilityAreas.clientId, clientId))
			.orderBy(desc(facilityAreas.createdAt));
	}

	async searchByClient(input: {
		clientId: string;
		query: string;
		limit?: number;
	}): Promise<FacilityAreaSearchRow[]> {
		const limit = Math.max(1, Math.min(input.limit ?? 40, 100));
		const searchExpressions = [
			facilityAreas.name,
			facilityAreas.slug,
			facilityAreas.description,
			facilities.name,
			facilities.slug
		];
		const relevance = buildSearchRelevanceExpression(input.query, searchExpressions);
		return await this.db
			.select({
				id: facilityAreas.id,
				clientId: facilityAreas.clientId,
				facilityId: facilityAreas.facilityId,
				name: facilityAreas.name,
				slug: facilityAreas.slug,
				capacity: facilityAreas.capacity,
				description: facilityAreas.description,
				isActive: facilityAreas.isActive,
				metadata: facilityAreas.metadata,
				createdAt: facilityAreas.createdAt,
				updatedAt: facilityAreas.updatedAt,
				createdUser: facilityAreas.createdUser,
				updatedUser: facilityAreas.updatedUser,
				facilityName: facilities.name
			})
			.from(facilityAreas)
			.leftJoin(facilities, eq(facilityAreas.facilityId, facilities.id))
			.where(
				and(
					eq(facilityAreas.clientId, input.clientId),
					eq(facilityAreas.isActive, 1),
					...buildSearchTokenClauses(input.query, searchExpressions)
				)
			)
			.orderBy(desc(relevance), asc(facilityAreas.name))
			.limit(limit);
	}

	async getById(id: string): Promise<FacilityArea | null> {
		const result = await this.db.select().from(facilityAreas).where(eq(facilityAreas.id, id));
		return result[0] || null;
	}

	async getByClientIdAndId(clientId: string, id: string): Promise<FacilityArea | null> {
		const result = await this.db
			.select()
			.from(facilityAreas)
			.where(and(eq(facilityAreas.clientId, clientId), eq(facilityAreas.id, id)))
			.limit(1);
		return result[0] ?? null;
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
		capacity?: number | null;
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
				capacity: data.capacity ?? null,
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
			capacity: number | null;
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
