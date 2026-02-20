import { and, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clientDatabaseRoutes, type ClientDatabaseRoute } from '../schema/index.js';

export type ClientDatabaseRouteMode = 'central_shared' | 'd1_binding';

export class ClientDatabaseRouteOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClientDatabaseRoute | null> {
		const result = await this.db
			.select()
			.from(clientDatabaseRoutes)
			.where(eq(clientDatabaseRoutes.clientId, clientId))
			.limit(1);
		return result[0] ?? null;
	}

	async getActiveByClientId(clientId: string): Promise<ClientDatabaseRoute | null> {
		const result = await this.db
			.select()
			.from(clientDatabaseRoutes)
			.where(
				and(
					eq(clientDatabaseRoutes.clientId, clientId),
					eq(clientDatabaseRoutes.status, 'active')
				)
			)
			.limit(1);
		return result[0] ?? null;
	}

	async ensureCentralSharedRoute(input: {
		clientId: string;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<ClientDatabaseRoute | null> {
		const existing = await this.getByClientId(input.clientId);
		if (existing) {
			return existing;
		}

		const now = new Date().toISOString();
		const result = await this.db
			.insert(clientDatabaseRoutes)
			.values({
				id: crypto.randomUUID(),
				clientId: input.clientId,
				routeMode: 'central_shared',
				bindingName: null,
				databaseId: null,
				status: 'active',
				metadata: null,
				createdAt: now,
				updatedAt: now,
				createdUser: input.createdUser ?? null,
				updatedUser: input.updatedUser ?? input.createdUser ?? null
			})
			.onConflictDoNothing({ target: clientDatabaseRoutes.clientId })
			.returning();

		if (result[0]) {
			return result[0];
		}

		return await this.getByClientId(input.clientId);
	}
}
