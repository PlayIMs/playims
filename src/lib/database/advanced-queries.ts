// Advanced query examples using Drizzle ORM
import { eq, and, or, like, desc, asc, count, sql } from 'drizzle-orm';
import type { D1Database } from '@cloudflare/workers-types';
import { createDrizzleClient, schema } from './drizzle.js';

// Platform interface for local development with wrangler
interface Platform {
	env?: {
		DB?: D1Database;
	};
}

export class AdvancedQueries {
	private db: ReturnType<typeof createDrizzleClient>;

	constructor(platform?: Platform) {
		this.db = createDrizzleClient(platform);
	}

	// Search clients by name or slug
	async searchClients(searchTerm: string) {
		return await this.db
			.select()
			.from(schema.clients)
			.where(
				or(
					like(schema.clients.name, `%${searchTerm}%`),
					like(schema.clients.slug, `%${searchTerm}%`)
				)
			)
			.orderBy(desc(schema.clients.createdAt));
	}

	// Get clients created in the last 30 days
	async getRecentClients() {
		const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

		return await this.db
			.select()
			.from(schema.clients)
			.where(sql`${schema.clients.createdAt} > ${thirtyDaysAgo}`)
			.orderBy(desc(schema.clients.createdAt));
	}

	// Get statistics
	async getStats() {
		const [clientCount, userCount] = await Promise.all([
			this.db.select({ count: count() }).from(schema.clients),
			this.db.select({ count: count() }).from(schema.users)
		]);

		return {
			totalClients: clientCount[0].count,
			totalUsers: userCount[0].count
		};
	}

	// Complex join query (if you add relationships later)
	async getClientsWithUsers() {
		// This is an example for when you might have relationships
		// Join clients with users based on client_id
		return await this.db
			.select({
				client: schema.clients,
				user: schema.users
			})
			.from(schema.clients)
			.leftJoin(schema.users, eq(schema.clients.id, schema.users.clientId));
	}

	// Get clients by name containing domain-like string
	async getClientsByDomain(domain: string) {
		return await this.db
			.select()
			.from(schema.clients)
			.where(like(schema.clients.name, `%${domain}%`))
			.orderBy(asc(schema.clients.name));
	}

	// Get users created within a date range
	async getUsersByDateRange(startDate: string, endDate: string) {
		return await this.db
			.select()
			.from(schema.users)
			.where(
				and(
					sql`${schema.users.createdAt} >= ${startDate}`,
					sql`${schema.users.createdAt} <= ${endDate}`
				)
			)
			.orderBy(desc(schema.users.createdAt));
	}
}
