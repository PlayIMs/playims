// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { D1Database } from '@cloudflare/workers-types';
import type { DatabaseOperations } from '$lib/database';
import type { ResolvedTenantDatabaseRoute } from '$lib/server/database/context';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Hydrated by hooks.server.ts from a validated session token.
			user?: {
				id: string;
				clientId: string;
				role: 'admin' | 'manager' | 'player';
				email?: string;
				firstName?: string | null;
				lastName?: string | null;
				cellPhone?: string | null;
				status?: string | null;
			};
			// Auth session metadata used for route/API authorization decisions.
			session?: {
				id: string;
				userId: string;
				clientId: string;
				activeClientId: string;
				role: 'admin' | 'manager' | 'player';
				authProvider: 'password' | string;
				expiresAt: string;
			};
			/**
			 * Optional per-request logging metadata used by SSR loaders to report table/row context
			 * through the centralized request logger in hooks.server.ts.
			 */
			requestLogMeta?: {
				table?: string;
				recordCount?: number | null;
			};
			requestId?: string;
			__dbCache?: {
				centralOps?: DatabaseOperations;
				tenantOps?: Map<string, DatabaseOperations>;
				tenantD1?: Map<string, D1Database>;
				tenantRoutes?: Map<string, ResolvedTenantDatabaseRoute>;
			};
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				AUTH_SIGNUP_INVITE_KEY?: string;
				AUTH_SESSION_SECRET?: string;
				AUTH_PASSWORD_PBKDF2_ITERATIONS?: string;
				AUTH_PASSWORD_PEPPER?: string;
				[binding: string]: unknown;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
