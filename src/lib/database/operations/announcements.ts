// Announcement operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { announcements, type Announcement } from '../schema/index.js';

export class AnnouncementOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId: string): Promise<Announcement[]> {
		return await this.db
			.select()
			.from(announcements)
			.where(eq(announcements.clientId, clientId))
			.orderBy(desc(announcements.publishedAt));
	}
}
