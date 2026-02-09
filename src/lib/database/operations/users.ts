// User operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { users, clients, type User, type Client } from '../schema/index.js';

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
			.leftJoin(clients, eq(users.clientId, clients.id))
			.where(eq(users.clientId, clientId))
			.orderBy(desc(users.createdAt));

		return result.map(this.mapResult);
	}
}
