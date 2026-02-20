// User operations - Drizzle ORM
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clients, userClients, users, type Client, type User } from '../schema/index.js';

export class UserOperations {
	constructor(private db: DrizzleClient) {}

	private mapResult(row: { user: User; client: Client | null }) {
		return {
			...row.user,
			client: row.client
		};
	}

	async getByClientId(clientId: string): Promise<any[]> {
		const result = await this.db
			.select({
				user: users,
				client: clients
			})
			.from(users)
			.innerJoin(
				userClients,
				and(
					eq(userClients.userId, users.id),
					eq(userClients.clientId, clientId),
					eq(userClients.status, 'active')
				)
			)
			.leftJoin(clients, eq(clients.id, userClients.clientId))
			.orderBy(desc(users.createdAt));

		return result.map(this.mapResult);
	}

	async getAuthByEmail(email: string): Promise<User | null> {
		const normalizedEmail = email.trim().toLowerCase();
		const result = await this.db
			.select()
			.from(users)
			.where(sql`lower(trim(${users.email})) = ${normalizedEmail}`)
			.limit(1);
		return result[0] ?? null;
	}

	// Auth lookups should use this helper instead of broad list queries.
	async getAuthById(userId: string): Promise<User | null> {
		const result = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
		return result[0] ?? null;
	}

	// Account self-service queries must stay scoped to authenticated tenant + user.
	async getAuthByIdForClient(userId: string, clientId: string): Promise<User | null> {
		const result = await this.db
			.select()
			.from(users)
			.where(
				and(
					eq(users.id, userId),
					sql`exists (
						select 1
						from ${userClients}
						where ${userClients.userId} = ${users.id}
							and ${userClients.clientId} = ${clientId}
							and ${userClients.status} = 'active'
					)`
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	// Creates an auth-ready user row with normalized email and security fields.
	async createAuthUser(data: {
		email: string;
		passwordHash: string;
		role: 'admin' | 'manager' | 'player';
		firstName?: string | null;
		lastName?: string | null;
		cellPhone?: string | null;
		status?: string;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<User | null> {
		const now = new Date().toISOString();
		const normalizedEmail = data.email.trim().toLowerCase();
		const result = await this.db
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				email: normalizedEmail,
				passwordHash: data.passwordHash,
				role: data.role,
				firstName: data.firstName ?? null,
				lastName: data.lastName ?? null,
				cellPhone: data.cellPhone ?? null,
				status: data.status ?? 'active',
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null,
				firstLoginAt: null,
				lastLoginAt: null,
				lastActiveAt: null,
				sessionCount: 0
			})
			.returning();

		return result[0] ?? null;
	}

	// Updates login audit metadata after successful authentication.
	async markLoginSuccess(userId: string): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(users)
			.set({
				lastLoginAt: now,
				lastActiveAt: now,
				firstLoginAt: sql`coalesce(${users.firstLoginAt}, ${now})`,
				sessionCount: sql`coalesce(${users.sessionCount}, 0) + 1`,
				updatedAt: now
			})
			.where(and(eq(users.id, userId), eq(users.status, 'active')))
			.returning();

		return result[0] ?? null;
	}

	// Lightweight per-request activity touch for active sessions.
	async touchLastActive(userId: string): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(users)
			.set({
				lastActiveAt: now,
				updatedAt: now
			})
			.where(and(eq(users.id, userId), eq(users.status, 'active')))
			.returning();

		return result[0] ?? null;
	}

	async updateSelfProfile(input: {
		userId: string;
		clientId: string;
		firstName: string | null;
		lastName: string | null;
		cellPhone: string | null;
		avatarUrl: string | null;
		timezone: string | null;
		updatedUser: string | null;
	}): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(users)
			.set({
				firstName: input.firstName,
				lastName: input.lastName,
				cellPhone: input.cellPhone,
				avatarUrl: input.avatarUrl,
				timezone: input.timezone,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(users.id, input.userId),
					sql`exists (
						select 1
						from ${userClients}
						where ${userClients.userId} = ${users.id}
							and ${userClients.clientId} = ${input.clientId}
							and ${userClients.status} = 'active'
					)`,
					eq(users.status, 'active')
				)
			)
			.returning();

		return result[0] ?? null;
	}

	async updateSelfPreferences(input: {
		userId: string;
		clientId: string;
		preferences: string | null;
		notes: string | null;
		updatedUser: string | null;
	}): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(users)
			.set({
				preferences: input.preferences,
				notes: input.notes,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(users.id, input.userId),
					sql`exists (
						select 1
						from ${userClients}
						where ${userClients.userId} = ${users.id}
							and ${userClients.clientId} = ${input.clientId}
							and ${userClients.status} = 'active'
					)`,
					eq(users.status, 'active')
				)
			)
			.returning();

		return result[0] ?? null;
	}

	async updateSelfPasswordHash(input: {
		userId: string;
		clientId: string;
		passwordHash: string;
		updatedUser: string | null;
	}): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(users)
			.set({
				passwordHash: input.passwordHash,
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(users.id, input.userId),
					sql`exists (
						select 1
						from ${userClients}
						where ${userClients.userId} = ${users.id}
							and ${userClients.clientId} = ${input.clientId}
							and ${userClients.status} = 'active'
					)`,
					eq(users.status, 'active')
				)
			)
			.returning();

		return result[0] ?? null;
	}

	async archiveSelf(input: {
		userId: string;
		clientId: string;
		updatedUser: string | null;
	}): Promise<User | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.update(users)
			.set({
				status: 'archived',
				updatedAt: now,
				updatedUser: input.updatedUser
			})
			.where(
				and(
					eq(users.id, input.userId),
					sql`exists (
						select 1
						from ${userClients}
						where ${userClients.userId} = ${users.id}
							and ${userClients.clientId} = ${input.clientId}
							and ${userClients.status} = 'active'
					)`,
					eq(users.status, 'active')
				)
			)
			.returning();

		return result[0] ?? null;
	}
}
