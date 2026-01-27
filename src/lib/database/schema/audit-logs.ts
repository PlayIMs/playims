// Audit logs schema
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const auditLogs = sqliteTable('audit_logs', {
	id: text().primaryKey(),
	clientId: text('client_id'),
	actorUserId: text('actor_user_id'),
	action: text(),
	entityType: text('entity_type'),
	entityId: text('entity_id'),
	details: text(),
	ipAddress: text('ip_address'),
	createdAt: text('created_at'),
	updatedAt: text('updated_at'),
	createdUser: text('created_user'),
	updatedUser: text('updated_user')
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
