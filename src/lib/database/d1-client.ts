// D1 REST API client for production use on Vercel
import type { Client, User } from './types.js';

interface D1RestApiOptions {
	accountId: string;
	databaseId: string;
	apiToken: string;
}

export class D1RestClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(options: D1RestApiOptions) {
		this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}`;
		this.headers = {
			Authorization: `Bearer ${options.apiToken}`,
			'Content-Type': 'application/json'
		};
	}

	private async query(sql: string, params: any[] = []): Promise<any> {
		const response = await fetch(`${this.baseUrl}/query`, {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({
				sql,
				params
			})
		});

		if (!response.ok) {
			throw new Error(`D1 API Error: ${response.status} ${response.statusText}`);
		}

		const result = await response.json();

		if (!result.success) {
			throw new Error(`D1 Query Error: ${result.errors?.[0]?.message || 'Unknown error'}`);
		}

		return result.result[0];
	}

	async getClients(): Promise<Client[]> {
		const result = await this.query('SELECT * FROM clients ORDER BY created_at DESC');
		return result.results || [];
	}

	async getClientById(id: number): Promise<Client | null> {
		const result = await this.query('SELECT * FROM clients WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async createClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
		const now = new Date().toISOString();
		const result = await this.query(
			'INSERT INTO clients (name, email, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *',
			[data.name, data.email, now, now]
		);
		return result.results[0];
	}

	async updateClient(
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
			return this.getClientById(id);
		}

		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(id);

		const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.query(query, values);
		return result.results?.[0] || null;
	}

	async deleteClient(id: number): Promise<boolean> {
		const result = await this.query('DELETE FROM clients WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}

	async getUsers(): Promise<User[]> {
		const result = await this.query('SELECT * FROM users ORDER BY created_at DESC');
		return result.results || [];
	}

	async getUserById(id: number): Promise<User | null> {
		const result = await this.query('SELECT * FROM users WHERE id = ?', [id]);
		return result.results?.[0] || null;
	}

	async createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
		const now = new Date().toISOString();
		const result = await this.query(
			'INSERT INTO users (username, email, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING *',
			[data.username, data.email, now, now]
		);
		return result.results[0];
	}

	async updateUser(
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
			return this.getUserById(id);
		}

		updates.push('updated_at = ?');
		values.push(new Date().toISOString());
		values.push(id);

		const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`;
		const result = await this.query(query, values);
		return result.results?.[0] || null;
	}

	async deleteUser(id: number): Promise<boolean> {
		const result = await this.query('DELETE FROM users WHERE id = ?', [id]);
		return result.meta.changes > 0;
	}
}
