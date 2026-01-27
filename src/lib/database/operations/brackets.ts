// Bracket operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { brackets, type Bracket } from '../schema/index.js';

export class BracketOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<Bracket[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(brackets)
				.where(eq(brackets.clientId, clientId))
				.orderBy(desc(brackets.createdAt));
		}

		return await this.db.select().from(brackets).orderBy(desc(brackets.createdAt));
	}

	async getById(id: string): Promise<Bracket | null> {
		const result = await this.db.select().from(brackets).where(eq(brackets.id, id));
		return result[0] || null;
	}

	async getByDivisionId(divisionId: string): Promise<Bracket[]> {
		return await this.db
			.select()
			.from(brackets)
			.where(eq(brackets.divisionId, divisionId))
			.orderBy(desc(brackets.startsAt));
	}

	async create(data: {
		clientId?: string;
		leagueId?: string;
		divisionId?: string;
		name: string;
		type?: string;
		startsAt?: string;
		endsAt?: string;
		status?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Bracket | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(brackets)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				leagueId: data.leagueId || null,
				divisionId: data.divisionId || null,
				name: data.name,
				type: data.type || null,
				startsAt: data.startsAt || null,
				endsAt: data.endsAt || null,
				status: data.status || 'draft',
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
			type: string;
			startsAt: string;
			endsAt: string;
			status: string;
			updatedUser: string;
		}>
	): Promise<Bracket | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(brackets)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(brackets.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(brackets).where(eq(brackets.id, id)).returning();
		return result.length > 0;
	}
}
