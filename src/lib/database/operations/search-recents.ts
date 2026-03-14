import { and, desc, eq, inArray } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { searchRecents, type SearchRecent } from '../schema/index.js';

export class SearchRecentOperations {
	constructor(private db: DrizzleClient) {}

	async listByUserAndClient(userId: string, clientId: string, limit = 10): Promise<SearchRecent[]> {
		return await this.db
			.select()
			.from(searchRecents)
			.where(and(eq(searchRecents.userId, userId), eq(searchRecents.clientId, clientId)))
			.orderBy(desc(searchRecents.updatedAt))
			.limit(limit);
	}

	async getByUserClientAndResultKey(
		userId: string,
		clientId: string,
		resultKey: string
	): Promise<SearchRecent | null> {
		const result = await this.db
			.select()
			.from(searchRecents)
			.where(
				and(
					eq(searchRecents.userId, userId),
					eq(searchRecents.clientId, clientId),
					eq(searchRecents.resultKey, resultKey)
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	async create(input: {
		userId: string;
		clientId: string;
		resultKey: string;
		category: string;
		title: string;
		subtitle?: string | null;
		href: string;
		badge?: string | null;
		meta?: string | null;
	}): Promise<SearchRecent | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(searchRecents)
			.values({
				id: crypto.randomUUID(),
				userId: input.userId,
				clientId: input.clientId,
				resultKey: input.resultKey,
				category: input.category,
				title: input.title,
				subtitle: input.subtitle ?? null,
				href: input.href,
				badge: input.badge ?? null,
				meta: input.meta ?? null,
				createdAt: now,
				updatedAt: now
			})
			.returning();
		return result[0] ?? null;
	}

	async touch(
		id: string,
		input: {
			category: string;
			title: string;
			subtitle?: string | null;
			href: string;
			badge?: string | null;
			meta?: string | null;
		}
	): Promise<SearchRecent | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(searchRecents)
			.set({
				category: input.category,
				title: input.title,
				subtitle: input.subtitle ?? null,
				href: input.href,
				badge: input.badge ?? null,
				meta: input.meta ?? null,
				updatedAt: now
			})
			.where(eq(searchRecents.id, id))
			.returning();
		return result[0] ?? null;
	}

	async deleteByIds(ids: string[]): Promise<number> {
		const normalizedIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
		if (normalizedIds.length === 0) return 0;
		const result = await this.db
			.delete(searchRecents)
			.where(inArray(searchRecents.id, normalizedIds))
			.returning({ id: searchRecents.id });
		return result.length;
	}
}
