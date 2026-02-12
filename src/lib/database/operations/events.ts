// Event operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { events, type Event } from '../schema/index.js';

export class EventOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<Event[]> {
		return await this.db
			.select()
			.from(events)
			.where(eq(events.clientId, clientId))
			.orderBy(desc(events.scheduledStartAt));
	}
}
