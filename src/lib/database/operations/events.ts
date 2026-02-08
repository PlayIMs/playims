// Event operations - Drizzle ORM
import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { events, type Event } from '../schema/index.js';

export class EventOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<Event[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(events)
				.where(eq(events.clientId, clientId))
				.orderBy(desc(events.scheduledStartAt));
		}
		return await this.db.select().from(events).orderBy(desc(events.scheduledStartAt));
	}

	async getById(id: string): Promise<Event | null> {
		const result = await this.db.select().from(events).where(eq(events.id, id));
		return result[0] || null;
	}

	async create(data: {
		clientId: string;
		type: string;
		offeringId?: string;
		leagueId?: string;
		divisionId?: string;
		facilityId?: string;
		facilityAreaId?: string;
		homeTeamId?: string;
		awayTeamId?: string;
		scheduledStartAt?: string;
		scheduledEndAt?: string;
		actualStartAt?: string;
		actualEndAt?: string;
		status?: string;
		isPostseason?: number;
		roundLabel?: string;
		weekNumber?: number;
		homeScore?: number;
		awayScore?: number;
		winnerTeamId?: string;
		forfeitType?: string;
		notes?: string;
		isActive?: number;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Event | null> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		const result = await this.db
			.insert(events)
			.values({
				id,
				clientId: data.clientId,
				type: data.type,
				offeringId: data.offeringId || null,
				leagueId: data.leagueId || null,
				divisionId: data.divisionId || null,
				facilityId: data.facilityId || null,
				facilityAreaId: data.facilityAreaId || null,
				homeTeamId: data.homeTeamId || null,
				awayTeamId: data.awayTeamId || null,
				scheduledStartAt: data.scheduledStartAt || null,
				scheduledEndAt: data.scheduledEndAt || null,
				actualStartAt: data.actualStartAt || null,
				actualEndAt: data.actualEndAt || null,
				status: data.status || 'scheduled',
				isPostseason: data.isPostseason ?? 0,
				roundLabel: data.roundLabel || null,
				weekNumber: data.weekNumber ?? null,
				homeScore: data.homeScore ?? null,
				awayScore: data.awayScore ?? null,
				winnerTeamId: data.winnerTeamId || null,
				forfeitType: data.forfeitType || null,
				notes: data.notes || null,
				isActive: data.isActive ?? 1,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser || null,
				updatedUser: data.updatedUser || data.createdUser || null
			})
			.returning();

		return result[0] || null;
	}

	async update(
		id: string,
		data: Partial<{
			type: string;
			offeringId: string;
			leagueId: string;
			divisionId: string;
			facilityId: string;
			facilityAreaId: string;
			homeTeamId: string;
			awayTeamId: string;
			scheduledStartAt: string;
			scheduledEndAt: string;
			actualStartAt: string;
			actualEndAt: string;
			status: string;
			isPostseason: number;
			roundLabel: string;
			weekNumber: number;
			homeScore: number;
			awayScore: number;
			winnerTeamId: string;
			forfeitType: string;
			notes: string;
			isActive: number;
			updatedUser: string;
		}>
	): Promise<Event | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(events)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(events.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(events).where(eq(events.id, id)).returning();
		return result.length > 0;
	}
}
