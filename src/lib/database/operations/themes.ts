// Theme operations - Drizzle ORM
import { eq, ne, desc, count, and } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { themes, type Theme } from '../schema/index.js';

export class ThemeOperations {
	constructor(private db: DrizzleClient) {}

	async getById(clientId: string, id: string): Promise<Theme | null> {
		const result = await this.db
			.select()
			.from(themes)
			.where(and(eq(themes.clientId, clientId), eq(themes.id, id)));
		return result[0] || null;
	}

	async getBySlug(clientId: string, slug: string): Promise<Theme | null> {
		const result = await this.db
			.select()
			.from(themes)
			.where(and(eq(themes.clientId, clientId), eq(themes.slug, slug)));
		return result[0] || null;
	}

	async getSaved(clientId: string): Promise<Theme[]> {
		return await this.db
			.select()
			.from(themes)
			.where(and(eq(themes.clientId, clientId), ne(themes.slug, 'current')))
			.orderBy(desc(themes.updatedAt), desc(themes.createdAt));
	}

	async countSaved(clientId: string): Promise<number> {
		const result = await this.db
			.select({ total: count() })
			.from(themes)
			.where(and(eq(themes.clientId, clientId), ne(themes.slug, 'current')));
		return result[0]?.total || 0;
	}

	async create(data: {
		id?: string;
		clientId: string;
		name: string;
		slug: string;
		primary: string;
		secondary: string;
		neutral: string;
		accent: string;
		createdAt?: string;
		updatedAt?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<Theme | null> {
		const now = data.createdAt || new Date().toISOString();
		const updatedAt = data.updatedAt || now;
		const id = data.id || crypto.randomUUID();

		const result = await this.db
			.insert(themes)
			.values({
				id,
				clientId: data.clientId,
				name: data.name,
				slug: data.slug,
				primary: data.primary,
				secondary: data.secondary,
				neutral: data.neutral,
				accent: data.accent,
				createdAt: now,
				updatedAt,
				createdUser: data.createdUser,
				updatedUser: data.updatedUser
			})
			.returning();

		return result[0] || null;
	}

	async update(
		clientId: string,
		id: string,
		data: Partial<{
			name: string;
			slug: string;
			primary: string;
			secondary: string;
			neutral: string;
			accent: string;
			createdAt: string;
			updatedAt: string;
			createdUser: string;
			updatedUser: string;
		}>
	): Promise<Theme | null> {
		const result = await this.db
			.update(themes)
			.set({
				...data
			})
			.where(and(eq(themes.clientId, clientId), eq(themes.id, id)))
			.returning();

		return result[0] || null;
	}

	async upsertCurrent(data: {
		clientId: string;
		primary: string;
		secondary: string;
		neutral: string;
		accent: string;
		userId?: string;
	}): Promise<Theme | null> {
		const existing = await this.getBySlug(data.clientId, 'current');
		const now = new Date().toISOString();

		if (existing) {
			return await this.update(data.clientId, existing.id, {
				name: 'Current Theme',
				slug: 'current',
				primary: data.primary,
				secondary: data.secondary,
				neutral: data.neutral,
				accent: data.accent,
				updatedAt: now,
				updatedUser: data.userId
			});
		}

		return await this.create({
			clientId: data.clientId,
			name: 'Current Theme',
			slug: 'current',
			primary: data.primary,
			secondary: data.secondary,
			neutral: data.neutral,
			accent: data.accent,
			createdAt: now,
			updatedAt: now,
			createdUser: data.userId,
			updatedUser: data.userId
		});
	}

	async delete(clientId: string, id: string): Promise<boolean> {
		const result = await this.db
			.delete(themes)
			.where(and(eq(themes.clientId, clientId), eq(themes.id, id)))
			.returning();
		return result.length > 0;
	}
}
