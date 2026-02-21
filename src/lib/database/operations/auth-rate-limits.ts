import { and, eq, lt, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { authRateLimits } from '../schema/index.js';

export type AuthRateLimitConsumeResult = {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	count: number;
};

export class AuthRateLimitOperations {
	constructor(private db: DrizzleClient) {}

	/**
	 * Atomically upserts and consumes a fixed-window counter.
	 */
	async consume(input: {
		key: string;
		windowMs: number;
		maxRequests: number;
		nowMs: number;
	}): Promise<AuthRateLimitConsumeResult> {
		const windowMs = Math.max(1, Math.trunc(input.windowMs));
		const nowMs = Math.max(0, Math.trunc(input.nowMs));
		const windowStartMs = nowMs - (nowMs % windowMs);
		const nowIso = new Date(nowMs).toISOString();

		await this.db
			.insert(authRateLimits)
			.values({
				id: crypto.randomUUID(),
				key: input.key,
				windowMs,
				windowStartMs,
				count: 1,
				createdAt: nowIso,
				updatedAt: nowIso
			})
			.onConflictDoUpdate({
				target: [authRateLimits.key, authRateLimits.windowMs],
				set: {
					count: sql`CASE
						WHEN ${authRateLimits.windowStartMs} = ${windowStartMs}
							THEN ${authRateLimits.count} + 1
						ELSE 1
					END`,
					windowStartMs,
					updatedAt: nowIso
				}
			});

		const bucket = await this.db
			.select({
				count: authRateLimits.count,
				windowStartMs: authRateLimits.windowStartMs
			})
			.from(authRateLimits)
			.where(and(eq(authRateLimits.key, input.key), eq(authRateLimits.windowMs, windowMs)))
			.limit(1);

		const count = Number(bucket[0]?.count ?? input.maxRequests + 1);
		const effectiveWindowStartMs = Number(bucket[0]?.windowStartMs ?? windowStartMs);
		const resetAt = effectiveWindowStartMs + windowMs;

		return {
			allowed: count <= input.maxRequests,
			remaining: Math.max(0, input.maxRequests - count),
			resetAt,
			count
		};
	}

	async purgeOlderThan(cutoffIso: string): Promise<number> {
		const deleted = await this.db
			.delete(authRateLimits)
			.where(lt(authRateLimits.updatedAt, cutoffIso))
			.returning({ id: authRateLimits.id });

		return deleted.length;
	}
}
