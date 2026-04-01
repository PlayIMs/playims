import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubTeams, type ClubTeam } from '../schema/index.js';

export class ClubTeamOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClubTeam[]> {
		return await this.db
			.select()
			.from(clubTeams)
			.where(eq(clubTeams.clientId, clientId))
			.orderBy(asc(clubTeams.name));
	}

	async getByLeagueId(leagueId: string): Promise<ClubTeam[]> {
		return await this.db
			.select()
			.from(clubTeams)
			.where(eq(clubTeams.clubLeagueId, leagueId))
			.orderBy(asc(clubTeams.name));
	}

	async getByLeagueIdAndSlug(leagueId: string, slug: string): Promise<ClubTeam | null> {
		const result = await this.db
			.select()
			.from(clubTeams)
			.where(and(eq(clubTeams.clubLeagueId, leagueId), eq(clubTeams.slug, slug)))
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		clubSeasonId: string;
		clubId: string;
		clubLeagueId: string;
		name: string;
		slug: string;
		description: string | null;
		imageUrl?: string | null;
		teamColor: string | null;
		currentRosterSize?: number;
		dateRegistered?: string | null;
		isActive: number;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<ClubTeam | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clubTeams)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				clubSeasonId: data.clubSeasonId,
				clubId: data.clubId,
				clubLeagueId: data.clubLeagueId,
				name: data.name,
				slug: data.slug,
				description: data.description,
				imageUrl: data.imageUrl ?? null,
				teamColor: data.teamColor,
				currentRosterSize: data.currentRosterSize ?? 0,
				dateRegistered: data.dateRegistered ?? now,
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
