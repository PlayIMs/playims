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

	async create(data: {
		clientId: string;
		offeringId: string;
		leagueId: string;
		divisionId: string;
		facilityId: string | null;
		facilityAreaId: string | null;
		homeTeamId: string;
		awayTeamId: string;
		scheduledStartAt: string;
		scheduledEndAt: string;
		status: string;
		isPostseason: number;
		roundLabel: string | null;
		weekNumber: number | null;
		notes: string | null;
		type: string;
		isActive: number;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<Event | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(events)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				offeringId: data.offeringId,
				leagueId: data.leagueId,
				divisionId: data.divisionId,
				facilityId: data.facilityId,
				facilityAreaId: data.facilityAreaId,
				homeTeamId: data.homeTeamId,
				awayTeamId: data.awayTeamId,
				scheduledStartAt: data.scheduledStartAt,
				scheduledEndAt: data.scheduledEndAt,
				actualStartAt: null,
				actualEndAt: null,
				status: data.status,
				isPostseason: data.isPostseason,
				roundLabel: data.roundLabel,
				weekNumber: data.weekNumber,
				homeScore: null,
				awayScore: null,
				winnerTeamId: null,
				forfeitType: null,
				notes: data.notes,
				type: data.type,
				isActive: data.isActive,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();

		return result[0] ?? null;
	}
}
