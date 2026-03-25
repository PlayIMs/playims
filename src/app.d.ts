// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { D1Database } from '@cloudflare/workers-types';
import type { DatabaseOperations } from '$lib/database';
import type { ResolvedTenantDatabaseRoute } from '$lib/server/database/context';
import type { AuthRole } from '$lib/server/auth/permissions';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Hydrated by hooks.server.ts from a validated session token.
			user?: {
				id: string;
				clientId: string;
				role: AuthRole;
				baseRole: AuthRole;
				canViewAsRole: boolean;
				isViewingAsRole: boolean;
				viewAsRole: AuthRole | null;
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
				role: AuthRole;
				baseRole: AuthRole;
				canViewAsRole: boolean;
				isViewingAsRole: boolean;
				viewAsRole: AuthRole | null;
				authProvider: 'password' | string;
				expiresAt: string;
			};
			/**
			 * Optional per-request logging metadata for the centralized request logger in hooks.server.ts.
			 * `table` lists extra touched tables (comma-separated) merged with tables inferred from Drizzle SQL.
			 */
			requestLogMeta?: {
				table?: string;
				recordCount?: number | null;
			};
			/** Populated by Drizzle query logging for request summary lines (comma-separated in logs). */
			dbTablesTouched?: Set<string>;
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
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
