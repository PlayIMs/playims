import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { sessions, users, type Session, type User } from '../schema/index.js';

// Shape used when resolving a session into an authenticated user context.
type SessionWithUser = {
	session: Session;
	user: User;
};

export class SessionOperations {
	constructor(private db: DrizzleClient) {}

	// Creates a new active session row for a successful login/register.
	async create(data: {
		id?: string;
		userId: string;
		clientId: string;
		tokenHash: string;
		authProvider?: string;
		expiresAt: string;
		lastSeenAt: string;
		ipAddress?: string | null;
		userAgent?: string | null;
	}): Promise<Session | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(sessions)
			.values({
				id: data.id ?? crypto.randomUUID(),
				userId: data.userId,
				clientId: data.clientId,
				tokenHash: data.tokenHash,
				authProvider: data.authProvider ?? 'password',
				createdAt: now,
				updatedAt: now,
				expiresAt: data.expiresAt,
				lastSeenAt: data.lastSeenAt,
				revokedAt: null,
				ipAddress: data.ipAddress ?? null,
				userAgent: data.userAgent ?? null,
				sessionVersion: 1
			})
			.returning();

		return result[0] ?? null;
	}

	async findValidByTokenHash(tokenHash: string, nowIso: string): Promise<SessionWithUser | null> {
		const result = await this.db
			.select({
				session: sessions,
				user: users
			})
			.from(sessions)
			.innerJoin(users, eq(sessions.userId, users.id))
			.where(
				and(
					eq(sessions.tokenHash, tokenHash),
					isNull(sessions.revokedAt),
					gt(sessions.expiresAt, nowIso)
				)
			);

		return result[0] ?? null;
	}

	// Sliding-session renewal updates expiry + last-seen timestamps.
	async extend(
		sessionId: string,
		data: {
			expiresAt: string;
			lastSeenAt: string;
		}
	): Promise<Session | null> {
		const result = await this.db
			.update(sessions)
			.set({
				expiresAt: data.expiresAt,
				lastSeenAt: data.lastSeenAt,
				updatedAt: data.lastSeenAt
			})
			.where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
			.returning();

		return result[0] ?? null;
	}

	async updateClientContext(
		sessionId: string,
		clientId: string,
		lastSeenAt: string
	): Promise<Session | null> {
		const result = await this.db
			.update(sessions)
			.set({
				clientId,
				lastSeenAt,
				updatedAt: lastSeenAt
			})
			.where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
			.returning();

		return result[0] ?? null;
	}

	// Single-session logout/revocation.
	async revokeById(sessionId: string): Promise<boolean> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(sessions)
			.set({
				revokedAt: now,
				updatedAt: now
			})
			.where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)))
			.returning();

		return result.length > 0;
	}

	// Optional bulk revocation helper (future "log out all devices").
	async revokeAllForUser(userId: string): Promise<number> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(sessions)
			.set({
				revokedAt: now,
				updatedAt: now
			})
			.where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
			.returning();

		return result.length;
	}

	async revokeAllForUserInClient(userId: string, clientId: string): Promise<number> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(sessions)
			.set({
				revokedAt: now,
				updatedAt: now
			})
			.where(
				and(eq(sessions.userId, userId), eq(sessions.clientId, clientId), isNull(sessions.revokedAt))
			)
			.returning();

		return result.length;
	}

	async revokeAllForUserExceptSessionInClient(
		userId: string,
		clientId: string,
		sessionId: string
	): Promise<number> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(sessions)
			.set({
				revokedAt: now,
				updatedAt: now
			})
			.where(
				and(
					eq(sessions.userId, userId),
					eq(sessions.clientId, clientId),
					ne(sessions.id, sessionId),
					isNull(sessions.revokedAt)
				)
			)
			.returning();

		return result.length;
	}

	async countActiveForUserInClient(userId: string, clientId: string, nowIso: string): Promise<number> {
		const result = await this.db
			.select({
				count: sql<number>`count(*)`
			})
			.from(sessions)
			.where(
				and(
					eq(sessions.userId, userId),
					eq(sessions.clientId, clientId),
					isNull(sessions.revokedAt),
					gt(sessions.expiresAt, nowIso)
				)
			);

		return Number(result[0]?.count ?? 0);
	}

	async getActiveForUserInClient(userId: string, clientId: string, nowIso: string): Promise<Session[]> {
		return await this.db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.userId, userId),
					eq(sessions.clientId, clientId),
					isNull(sessions.revokedAt),
					gt(sessions.expiresAt, nowIso)
				)
			)
			.orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt));
	}

	async getActiveByIdForUserInClient(
		sessionId: string,
		userId: string,
		clientId: string,
		nowIso: string
	): Promise<Session | null> {
		const result = await this.db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.id, sessionId),
					eq(sessions.userId, userId),
					eq(sessions.clientId, clientId),
					isNull(sessions.revokedAt),
					gt(sessions.expiresAt, nowIso)
				)
			)
			.limit(1);

		return result[0] ?? null;
	}
}
