// D1 REST API client for production use
// Provides a unified interface for both D1 Binding (Cloudflare Pages/Workers) and REST API (external)

import { env } from '$env/dynamic/private';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * Transform snake_case database fields to camelCase to match Drizzle schema
 */
function transformToCamelCase(obj: any): any {
	if (obj === null || obj === undefined) return obj;
	if (Array.isArray(obj)) return obj.map(transformToCamelCase);
	if (typeof obj !== 'object') return obj;

	const transformed: any = {};
	for (const [key, value] of Object.entries(obj)) {
		// Convert snake_case to camelCase
		const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
		transformed[camelKey] = transformToCamelCase(value);
	}
	return transformed;
}

export class D1RestClient {
	private baseUrl?: string;
	private headers?: Record<string, string>;
	private binding?: D1Database;

	constructor(binding?: D1Database) {
		if (binding) {
			this.binding = binding;
		} else {
			// Fallback to REST API if configured
			const accountId = env.CLOUDFLARE_ACCOUNT_ID;
			const databaseId = env.CLOUDFLARE_DATABASE_ID;
			const apiToken = env.CLOUDFLARE_API_TOKEN;

			if (accountId && databaseId && apiToken) {
				this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
				this.headers = {
					Authorization: `Bearer ${apiToken}`,
					'Content-Type': 'application/json'
				};
			}
		}
	}

	async query(sql: string, params: any[] = []): Promise<any> {
		// Use D1 Binding if available (preferred for Cloudflare Pages/Workers)
		if (this.binding) {
			try {
				const stmt = this.binding.prepare(sql).bind(...params);
				const result = await stmt.all();
				return {
					success: true,
					results: result.results,
					meta: result.meta
				};
			} catch (error: any) {
				throw new Error(`D1 Binding Error: ${error.message}`);
			}
		}

		// Fallback to REST API
		if (this.baseUrl && this.headers) {
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

		throw new Error(
			'No database connection available (neither D1 binding nor REST API credentials)'
		);
	}
}
