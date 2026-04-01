import { desc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubEvents, type ClubEvent } from '../schema/index.js';

export class ClubEventOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClubEvent[]> {
		return await this.db
			.select()
			.from(clubEvents)
			.where(eq(clubEvents.clientId, clientId))
			.orderBy(desc(clubEvents.scheduledStartAt));
	}
}
