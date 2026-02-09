// Offering operations - Drizzle ORM
import { eq, asc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { offerings, type Offering } from '../schema/index.js';

export class OfferingOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Offering[]> {
		return await this.db
			.select()
			.from(offerings)
			.where(eq(offerings.clientId, clientId))
			.orderBy(asc(offerings.name));
	}
}
