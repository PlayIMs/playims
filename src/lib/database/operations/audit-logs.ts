// Audit log operations - Drizzle ORM
import { eq, desc } from 'drizzle-orm';
import type { DrizzleClient } from '../drizzle.js';
import { auditLogs, type AuditLog } from '../schema/index.js';

export class AuditLogOperations {
	constructor(private db: DrizzleClient) {}

	async getAll(clientId?: string): Promise<AuditLog[]> {
		if (clientId) {
			return await this.db
				.select()
				.from(auditLogs)
				.where(eq(auditLogs.clientId, clientId))
				.orderBy(desc(auditLogs.createdAt));
		}

		return await this.db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
	}

	async getById(id: string): Promise<AuditLog | null> {
		const result = await this.db.select().from(auditLogs).where(eq(auditLogs.id, id));
		return result[0] || null;
	}

	async getByActorUserId(actorUserId: string): Promise<AuditLog[]> {
		return await this.db
			.select()
			.from(auditLogs)
			.where(eq(auditLogs.actorUserId, actorUserId))
			.orderBy(desc(auditLogs.createdAt));
	}

	async create(data: {
		clientId?: string;
		actorUserId?: string;
		action: string;
		entityType?: string;
		entityId?: string;
		details?: string;
		ipAddress?: string;
		createdUser?: string;
		updatedUser?: string;
	}): Promise<AuditLog | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.insert(auditLogs)
			.values({
				id: crypto.randomUUID(),
				clientId: data.clientId || null,
				actorUserId: data.actorUserId || null,
				action: data.action,
				entityType: data.entityType || null,
				entityId: data.entityId || null,
				details: data.details || null,
				ipAddress: data.ipAddress || null,
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
			details: string;
			updatedUser: string;
		}>
	): Promise<AuditLog | null> {
		const now = new Date().toISOString();

		const result = await this.db
			.update(auditLogs)
			.set({
				...data,
				updatedAt: now
			})
			.where(eq(auditLogs.id, id))
			.returning();

		return result[0] || null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.db.delete(auditLogs).where(eq(auditLogs.id, id)).returning();
		return result.length > 0;
	}
}
