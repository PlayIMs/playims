import { and, asc, eq } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { clubOfficerTitles, type ClubOfficerTitle } from '../schema/index.js';

export class ClubOfficerTitleOperations {
	constructor(private db: DrizzleClient) {}

	async getByClientId(clientId: string): Promise<ClubOfficerTitle[]> {
		return await this.db
			.select()
			.from(clubOfficerTitles)
			.where(eq(clubOfficerTitles.clientId, clientId))
			.orderBy(asc(clubOfficerTitles.name));
	}

	async getByClientIdAndId(clientId: string, titleId: string): Promise<ClubOfficerTitle | null> {
		const result = await this.db
			.select()
			.from(clubOfficerTitles)
			.where(and(eq(clubOfficerTitles.clientId, clientId), eq(clubOfficerTitles.id, titleId)))
			.limit(1);
		return result[0] ?? null;
	}

	async create(data: {
		clientId: string;
		clubId?: string | null;
		name: string;
		slug: string;
		scope: string;
		isBuiltIn: number;
		isOrgManaged: number;
		isActive: number;
		createdUser?: string | null;
		updatedUser?: string | null;
	}): Promise<ClubOfficerTitle | null> {
		const now = new Date().toISOString();
		const result = await this.db
			.insert(clubOfficerTitles)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId,
				clubId: data.clubId ?? null,
				name: data.name,
				slug: data.slug,
				scope: data.scope,
				isBuiltIn: data.isBuiltIn,
				isOrgManaged: data.isOrgManaged,
				isActive: data.isActive,
				createdAt: now,
				updatedAt: now,
				createdUser: data.createdUser ?? null,
				updatedUser: data.updatedUser ?? data.createdUser ?? null
			})
			.returning();
		return result[0] ?? null;
	}

	async updateByClientIdAndId(
		clientId: string,
		titleId: string,
		data: {
			name: string;
			slug: string;
			scope: string;
			isActive: number;
			updatedUser?: string | null;
		}
	): Promise<ClubOfficerTitle | null> {
		const result = await this.db
			.update(clubOfficerTitles)
			.set({
				name: data.name,
				slug: data.slug,
				scope: data.scope,
				isActive: data.isActive,
				updatedAt: new Date().toISOString(),
				updatedUser: data.updatedUser ?? null
			})
			.where(and(eq(clubOfficerTitles.clientId, clientId), eq(clubOfficerTitles.id, titleId)))
			.returning();
		return result[0] ?? null;
	}
}
