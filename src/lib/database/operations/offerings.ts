// Offering operations - Drizzle ORM
import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { offerings, type Offering } from '../schema/index.js';

export class OfferingOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Offering[]> {
		return await this.db
			.select()
			.from(offerings)
			.where(eq(offerings.clientId, clientId))
			.orderBy(asc(offerings.name));
	}

	async getByClientIdAndSlug(clientId: string, slug: string): Promise<Offering | null> {
		const result = await this.db
			.select()
			.from(offerings)
			.where(and(eq(offerings.clientId, clientId), eq(offerings.slug, slug)))
			.limit(1);

		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		name: string;
		slug: string;
		isActive: number;
		imageUrl: string;
		minPlayers: number;
		maxPlayers: number;
		rulebookUrl: string;
		sport: string;
		type: 'league' | 'tournament';
		description: string;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<Offering | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(offerings)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				name: data.name,
				slug: data.slug,
				isActive: data.isActive,
				imageUrl: data.imageUrl,
				minPlayers: data.minPlayers,
				maxPlayers: data.maxPlayers,
				rulebookUrl: data.rulebookUrl,
				sport: data.sport,
				type: data.type,
				description: data.description,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}

	async deleteById(id: string): Promise<boolean> {
		const result = await this.db.delete(offerings).where(eq(offerings.id, id)).returning();
		return result.length > 0;
	}
}
