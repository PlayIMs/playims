// Client operations - Drizzle ORM
import { eq, sql } from 'drizzle-orm';
import { validateClientSlug } from '$lib/server/client-slug';
import type { DrizzleClient } from '../drizzle.js';
import { clients, type Client } from '../schema/index.js';

export class ClientOperations {
	constructor(private db: DrizzleClient) {}

	async getById(id: string): Promise<Client | null> {
		const result = await this.db.select().from(clients).where(eq(clients.id, id));
		return result[0] || null;
	}

	async getByNormalizedSlug(slug: string): Promise<Client | null> {
		const validation = validateClientSlug(slug);
		if (!validation.ok) {
			return null;
		}

		const normalizedSlug = validation.slug;
		const result = await this.db
			.select()
			.from(clients)
			.where(sql`lower(trim(${clients.slug})) = ${normalizedSlug}`)
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		id?: string;
		name: string;
		slug: string;
		selfJoinEnabled?: boolean;
		metadata?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Client | null> {
		const now = new Date().toISOString();
		const id = data.id || crypto.randomUUID();
		const slugValidation = validateClientSlug(data.slug);
		if (!slugValidation.ok) {
			throw new Error(slugValidation.code);
		}

		const result = await this.db
			.insert(clients)
			.values({
				id,
				name: data.name,
				slug: slugValidation.slug,
				selfJoinEnabled: data.selfJoinEnabled ? 1 : 0,
				metadata: data.metadata || null,
				status: 'active',
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser || null,
				updatedUser: data.updatedUser || data.createdUser || null
			})
			.returning();

		return result[0] || null;
	}
}
