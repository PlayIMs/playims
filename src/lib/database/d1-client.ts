// D1 REST API client for production use on Vercel
// Provides the same interface as Drizzle but uses Cloudflare's HTTP API

import {
	CLOUDFLARE_ACCOUNT_ID,
	CLOUDFLARE_DATABASE_ID,
	CLOUDFLARE_API_TOKEN
} from '$env/static/private';

export class D1RestClient {
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor() {
		this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_DATABASE_ID}`;
		this.headers = {
			Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
			'Content-Type': 'application/json'
		};
	}

	async query(sql: string, params: any[] = []): Promise<any> {
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
}
