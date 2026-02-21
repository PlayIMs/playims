import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { signupInviteKeys, type SignupInviteKey } from '../schema/index.js';

export class SignupInviteKeyOperations {
	constructor(private db: DrizzleClient) {}

	async create(input: {
		keyHash: string;
		uses: number;
		expiresAt?: string | null;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<SignupInviteKey | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(signupInviteKeys)
			.values({
				id: crypto.randomUUID(),
				keyHash: input.keyHash,
				uses: Math.max(0, Math.trunc(input.uses)),
				expiresAt: input.expiresAt ?? null,
				createdAt: now,
				updatedAt: now,
				lastUsedAt: null,
				createdUser: input.createdUser ?? null,
				updatedUser: input.updatedUser ?? input.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}

	/**
	 * Atomically consumes one use from an invite key when it is active and not expired.
	 */
	async consumeByHash(keyHash: string, nowIso: string): Promise<SignupInviteKey | null> {
		const result = await this.db
			.update(signupInviteKeys)
			.set({
				uses: sql`coalesce(${signupInviteKeys.uses}, 0) - 1`,
				lastUsedAt: nowIso,
				updatedAt: nowIso
			})
			.where(
				and(
					eq(signupInviteKeys.keyHash, keyHash),
					gt(signupInviteKeys.uses, 0),
					or(isNull(signupInviteKeys.expiresAt), gt(signupInviteKeys.expiresAt, nowIso))
				)
			)
			.returning();

		return result[0] ?? null;
	}
}
