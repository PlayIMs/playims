// Client operations - Works with both Drizzle (local) and REST API (production)
import { eq, desc } from 'drizzle-orm';
import { clients, type Client } from '../schema.js';
import type { D1RestClient } from '../d1-client.js';

type DatabaseClient = ReturnType<typeof import('../drizzle.js').createDrizzleClient> | D1RestClient;

export class ClientOperations {
	private isDrizzle: boolean;

	constructor(private db: DatabaseClient) {
		// Check if this is a Drizzle client or REST client
		this.isDrizzle = 'select' in db;
	}

	async getAll(): Promise<Client[]> {
		if (this.isDrizzle) {
			// Drizzle ORM
			return await (this.db as any).select().from(clients).orderBy(desc(clients.createdAt));
		} else {
			// REST API
			const result = await (this.db as D1RestClient).query(
				'SELECT * FROM clients ORDER BY created_at DESC'
			);
			return result.results || [];
		}
	}

	async getById(id: string): Promise<Client | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(clients)
				.where(eq(clients.id, id))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM clients WHERE id = ?', [
				id
			]);
			return result.results?.[0] || null;
		}
	}

	async getBySlug(slug: string): Promise<Client | null> {
		if (this.isDrizzle) {
			const result = await (this.db as any)
				.select()
				.from(clients)
				.where(eq(clients.slug, slug))
				.limit(1);
			return result[0] || null;
		} else {
			const result = await (this.db as D1RestClient).query('SELECT * FROM clients WHERE slug = ?', [
				slug
			]);
			return result.results?.[0] || null;
		}
	}

	async getActive(): Promise<Client[]> {
		if (this.isDrizzle) {
			return await (this.db as any)
				.select()
				.from(clients)
				.where(eq(clients.status, 'active'))
				.orderBy(desc(clients.createdAt));
		} else {
			const result = await (this.db as D1RestClient).query(
				"SELECT * FROM clients WHERE status = 'active' ORDER BY created_at DESC"
			);
			return result.results || [];
		}
	}

	async create(data: { name: string; slug: string; metadata?: string }): Promise<Client> {
		const now = new Date().toISOString();
		const id = crypto.randomUUID();

		if (this.isDrizzle) {
			const result = await (this.db as any)
				.insert(clients)
				.values({
					id,
					name: data.name,
					slug: data.slug,
					metadata: data.metadata || null,
					createdAt: now,
					updatedAt: now,
					status: 'active'
				})
				.returning();
			return result[0];
		} else {
			const result = await (this.db as D1RestClient).query(
				'INSERT INTO clients (id, name, slug, metadata, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *',
				[id, data.name, data.slug, data.metadata || null, 'active', now, now]
			);
			return result.results[0];
		}
	}

	async update(
		id: string,
		data: Partial<{ name: string; slug: string; status: string; metadata: string }>
	): Promise<Client | null> {
		const now = new Date().toISOString();

		if (this.isDrizzle) {
			const updateData = { ...data, updatedAt: now };
			const result = await (this.db as any)
				.update(clients)
				.set(updateData)
				.where(eq(clients.id, id))
				.returning();
			return result[0] || null;
		} else {
			const updates: string[] = [];
			const values: any[] = [];

			Object.entries(data).forEach(([key, value]) => {
				if (value !== undefined) {
					const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
					updates.push(`${dbKey} = ?`);
					values.push(value);
				}
			});

			if (updates.length === 0) {
				return this.getById(id);
			}

			updates.push('updated_at = ?');
			values.push(now);
			values.push(id);

			const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
			const result = await (this.db as D1RestClient).query(query, values);
			return result.results?.[0] || null;
		}
	}

	async delete(id: string): Promise<boolean> {
		if (this.isDrizzle) {
			const result = await (this.db as any).delete(clients).where(eq(clients.id, id)).returning();
			return result.length > 0;
		} else {
			const result = await (this.db as D1RestClient).query('DELETE FROM clients WHERE id = ?', [
				id
			]);
			return result.meta.changes > 0;
		}
	}
}
