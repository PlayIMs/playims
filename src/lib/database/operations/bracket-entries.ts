// Bracket entry operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { bracketEntries, type BracketEntry } from '../schema/index.js';

export class BracketEntryOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<BracketEntry[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(bracketEntries)
				.where(eq(bracketEntries.clientId, clientId))
				.orderBy(desc(bracketEntries.createdAt));
		}

		return await this.db.select().from(bracketEntries).orderBy(desc(bracketEntries.createdAt));
	}

	async getById(id: string): Promise<BracketEntry | null> {
		const result = await this.db.select().from(bracketEntries).where(eq(bracketEntries.id, id));
		return result[0] || null;
	}

	async getByBracketId(bracketId: string): Promise<BracketEntry[]> {
		return await this.db
			.select()
			.from(bracketEntries)
			.where(eq(bracketEntries.bracketId, bracketId))
			.orderBy(desc(bracketEntries.seed));
	}

	async create(data: {
		clientId?: string;
		bracketId?: string;
		seed?: number;
		teamId?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<BracketEntry | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(bracketEntries)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				bracketId: data.bracketId || null,
				seed: data.seed ?? null,
				teamId: data.teamId || null,
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
			bracketId: string;
			seed: number;
			teamId: string;
			updatedUser: string;
		}>
	): Promise<BracketEntry | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(bracketEntries)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(bracketEntries.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(bracketEntries).where(eq(bracketEntries.id, id)).returning();
		return result.length > 0;
	}
}
