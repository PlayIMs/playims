import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { userClients, type UserClient } from '../schema/index.js';

export class UserClientOperations {
	constructor(private db: DrizzleClient) {}

	async getActiveMembership(userId: string, clientId: string): Promise<UserClient | null> {
		const result = await this.db
			.select()
			.from(userClients)
			.where(
				and(
					eq(userClients.userId, userId),
					eq(userClients.clientId, clientId),
					eq(userClients.status, 'active')
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	async getDefaultActiveForUser(userId: string): Promise<UserClient | null> {
		const result = await this.db
			.select()
			.from(userClients)
			.where(
				and(
					eq(userClients.userId, userId),
					eq(userClients.status, 'active'),
					eq(userClients.isDefault, 1)
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	async getFirstActiveForUser(userId: string): Promise<UserClient | null> {
		const result = await this.db
			.select()
			.from(userClients)
			.where(and(eq(userClients.userId, userId), eq(userClients.status, 'active')))
			.orderBy(asc(userClients.createdAt))
			.limit(1);
		return result[0] ?? null;
	}

	async listActiveForUser(userId: string): Promise<UserClient[]> {
		return await this.db
			.select()
			.from(userClients)
			.where(and(eq(userClients.userId, userId), eq(userClients.status, 'active')))
			.orderBy(asc(userClients.createdAt));
	}

	async ensureMembership(input: {
		userId: string;
		clientId: string;
		role?: string | null;
		status?: string | null;
		isDefault?: boolean;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<UserClient | null> {
		const now = new Date().toISOString();
		const role = input.role?.trim() || 'player';
		const status = input.status?.trim() || 'active';
		const isDefault = input.isDefault && status === 'active' ? 1 : 0;

		if (isDefault === 1) {
			await this.db
				.update(userClients)
				.set({
					isDefault: 0,
					updatedAt: now,
					updatedUser: input.updatedUser ?? input.createdUser ?? null
				})
				.where(and(eq(userClients.userId, input.userId), eq(userClients.isDefault, 1)));
		}

		const existing = await this.db
			.select()
			.from(userClients)
			.where(and(eq(userClients.userId, input.userId), eq(userClients.clientId, input.clientId)))
			.limit(1);

		if (existing[0]) {
			const updated = await this.db
				.update(userClients)
				.set({
					role,
					status,
					isDefault,
					updatedAt: now,
					updatedUser: input.updatedUser ?? input.createdUser ?? null
				})
				.where(and(eq(userClients.userId, input.userId), eq(userClients.clientId, input.clientId)))
				.returning();
			return updated[0] ?? null;
		}

		const created = await this.db
			.insert(userClients)
			.values({
				id: crypto.randomUUID(),
				userId: input.userId,
				clientId: input.clientId,
				role,
				status,
				isDefault,
				createdAt: now,
				updatedAt: now,
				createdUser: input.createdUser ?? null,
				updatedUser: input.updatedUser ?? input.createdUser ?? null
			})
			.returning();

		return created[0] ?? null;
	}

	async setDefaultMembership(userId: string, clientId: string): Promise<UserClient | null> {
		const now = new Date().toISOString();
		const target = await this.getActiveMembership(userId, clientId);
		if (!target) {
			return null;
		}

		await this.db
			.update(userClients)
			.set({
				isDefault: 0,
				updatedAt: now
			})
			.where(and(eq(userClients.userId, userId), eq(userClients.isDefault, 1)));

		const updated = await this.db
			.update(userClients)
			.set({
				isDefault: 1,
				updatedAt: now
			})
			.where(and(eq(userClients.userId, userId), eq(userClients.clientId, clientId)))
			.returning();
		return updated[0] ?? null;
	}
}
