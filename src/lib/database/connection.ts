import type { Client, User, DatabaseConnection } from './types.js';
import { D1RestClient } from './d1-client.js';
import {
	CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_DATABASE_ID,
	CLOUDFLARE_API_TOKEN
} from '$env/static/private';

// Platform interface for local development with wrangler
interface Platform {
	env?: {
		DB?: D1Database;
	};
}

/**
 * Creates a database connection instance with all query methods
 * Works in both local development (with wrangler) and production (with D1 REST API)
 * @param platform - Optional SvelteKit platform object for local development
 * @returns DatabaseConnection instance with clients and users query methods
 */
export function createDatabaseConnection(platform?: Platform): DatabaseConnection {
	// Check if we're in local development with wrangler (platform.env.DB available)
	const isLocalDevelopment = platform?.env?.DB;

	if (isLocalDevelopment) {
		const db = platform.env.DB!;

		return {
			clients: {
				async getAll(): Promise<Client[]> {
					const result = await db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
					return result.results as Client[];
				},

				async getById(id: number): Promise<Client | null> {
					const result = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
					return (result as Client) || null;
				},

				async create(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
					const now = new Date().toISOString();
					const result = await db
						.prepare(
							'INSERT INTO clients (name, email, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *'
						)
						.bind(data.name, data.email, now, now)
						.first();
					return result as Client;
				},

				async update(
					id: number,
					data: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>
				): Promise<Client | null> {
					const updates: string[] = [];
					const values: any[] = [];

					if (data.name !== undefined) {
						updates.push('name = ?');
						values.push(data.name);
					}
					if (data.email !== undefined) {
						updates.push('email = ?');
						values.push(data.email);
					}

					if (updates.length === 0) {
						return this.getById(id);
					}

					updates.push('updated_at = ?');
					values.push(new Date().toISOString());
					values.push(id);

					const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
					const result = await db
						.prepare(query)
						.bind(...values)
						.first();
					return (result as Client) || null;
				},

				async delete(id: number): Promise<boolean> {
					const result = await db.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
					return result.success && result.changes > 0;
				}
			},

			users: {
				async getAll(): Promise<User[]> {
					const result = await db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
					return result.results as User[];
				},

				async getById(id: number): Promise<User | null> {
					const result = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
					return (result as User) || null;
				},

				async create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
					const now = new Date().toISOString();
					const result = await db
						.prepare(
							'INSERT INTO users (username, email, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *'
						)
						.bind(data.username, data.email, now, now)
						.first();
					return result as User;
				},

				async update(
					id: number,
					data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
				): Promise<User | null> {
					const updates: string[] = [];
					const values: any[] = [];

					if (data.username !== undefined) {
						updates.push('username = ?');
						values.push(data.username);
					}
					if (data.email !== undefined) {
						updates.push('email = ?');
						values.push(data.email);
					}

					if (updates.length === 0) {
						return this.getById(id);
					}

					updates.push('updated_at = ?');
					values.push(new Date().toISOString());
					values.push(id);

					const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
					const result = await db
						.prepare(query)
						.bind(...values)
						.first();
					return (result as User) || null;
				},

				async delete(id: number): Promise<boolean> {
					const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
					return result.success && result.changes > 0;
				}
			}
		};
	} else {
		// Production mode: use D1 REST API
		const d1Client = new D1RestClient({
			accountId: CLOUDFLARE_ACCOUNT_ID,
			databaseId: CLOUDFLARE_DATABASE_ID,
			apiToken: CLOUDFLARE_API_TOKEN
		});

		return {
			clients: {
				async getAll(): Promise<Client[]> {
					return d1Client.getClients();
				},

				async getById(id: number): Promise<Client | null> {
					return d1Client.getClientById(id);
				},

				async create(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
					return d1Client.createClient(data);
				},

				async update(
					id: number,
					data: Partial<Omit<Client, 'id' | 'created_at' | 'updated_at'>>
				): Promise<Client | null> {
					return d1Client.updateClient(id, data);
				},

				async delete(id: number): Promise<boolean> {
					return d1Client.deleteClient(id);
				}
			},

			users: {
				async getAll(): Promise<User[]> {
					return d1Client.getUsers();
				},

				async getById(id: number): Promise<User | null> {
					return d1Client.getUserById(id);
				},

				async create(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
					return d1Client.createUser(data);
				},

				async update(
					id: number,
					data: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
				): Promise<User | null> {
					return d1Client.updateUser(id, data);
				},

				async delete(id: number): Promise<boolean> {
					return d1Client.deleteUser(id);
				}
			}
		};
	}
}
