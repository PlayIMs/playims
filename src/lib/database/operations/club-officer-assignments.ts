import { eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubOfficerAssignments, type ClubOfficerAssignment } from '../schema/index.js';

export class ClubOfficerAssignmentOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClubOfficerAssignment[]> {
		return await this.db
			.select()
			.from(clubOfficerAssignments)
			.where(eq(clubOfficerAssignments.clientId, clientId));
	}

	async create(data: {
		clientId: string;
		clubSeasonId: string;
		clubId: string;
		clubLeagueId?: string | null;
		clubTeamId?: string | null;
		titleId: string;
		userId: string;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<ClubOfficerAssignment | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clubOfficerAssignments)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				clubSeasonId: data.clubSeasonId,
				clubId: data.clubId,
				clubLeagueId: data.clubLeagueId ?? null,
				clubTeamId: data.clubTeamId ?? null,
				titleId: data.titleId,
				userId: data.userId,
				isActive: 1,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();
		return result[0] ?? null;
	}
}
