import { DatabaseOperations, type ClientDatabaseRoute } from '$lib/database';
import type { D1Database } from '@cloudflare/workers-types';
import type { RequestEvent } from '@sveltejs/kit';
import type { ClientDatabaseRouteMode } from '$lib/database/operations/client-database-routes';

type DbContextEvent = Pick<RequestEvent, 'locals' | 'platform'>;

export type ResolvedTenantDatabaseRoute = {
	clientId: string;
	routeMode: ClientDatabaseRouteMode;
	bindingName: string | null;
	databaseId: string | null;
	status: string;
	metadata: string | null;
};

export class DatabaseRouteResolutionError extends Error {
	public code: string;
	public status: number;

	constructor(code: string, message: string, status = 500) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

const isD1Database = (value: unknown): value is D1Database =>
	typeof value === 'object' && value !== null && typeof (value as D1Database).prepare === 'function';

const collectErrorMessages = (error: unknown): string[] => {
	const messages: string[] = [];
	const queue: unknown[] = [error];
	const visited = new Set<unknown>();

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current || visited.has(current)) {
			continue;
		}
		visited.add(current);

		if (current instanceof Error) {
			if (current.message) {
				messages.push(current.message);
			}
			if ('cause' in current) {
				queue.push((current as { cause?: unknown }).cause);
			}
			continue;
		}

		if (typeof current === 'object') {
			const candidate = current as { message?: unknown; cause?: unknown };
			if (typeof candidate.message === 'string' && candidate.message.length > 0) {
				messages.push(candidate.message);
			}
			if (candidate.cause !== undefined) {
				queue.push(candidate.cause);
			}
		}
	}

	return messages;
};

const isMissingClientRoutesTableError = (error: unknown): boolean => {
	const messages = collectErrorMessages(error);
	return messages.some((message) => /no such table:\s*client_database_routes/i.test(message));
};

const getDbCache = (event: DbContextEvent) => {
	if (!event.locals.__dbCache) {
		event.locals.__dbCache = {
			tenantOps: new Map(),
			tenantD1: new Map(),
			tenantRoutes: new Map()
		};
	}

	if (!event.locals.__dbCache.tenantOps) {
		event.locals.__dbCache.tenantOps = new Map();
	}
	if (!event.locals.__dbCache.tenantD1) {
		event.locals.__dbCache.tenantD1 = new Map();
	}
	if (!event.locals.__dbCache.tenantRoutes) {
		event.locals.__dbCache.tenantRoutes = new Map();
	}

	return event.locals.__dbCache;
};

const requireCentralD1Database = (event: DbContextEvent): D1Database => {
	const db = event.platform?.env?.DB;
	if (!isD1Database(db)) {
		throw new DatabaseRouteResolutionError(
			'DB_NOT_CONFIGURED',
			'Database binding is not configured.',
			500
		);
	}

	return db;
};

const mapRouteRecord = (
	clientId: string,
	route: ClientDatabaseRoute | null | undefined
): ResolvedTenantDatabaseRoute | null => {
	if (!route) {
		return null;
	}

	const routeMode = (route.routeMode?.trim().toLowerCase() ?? '') as ClientDatabaseRouteMode;
	if (routeMode !== 'central_shared' && routeMode !== 'd1_binding') {
		throw new DatabaseRouteResolutionError(
			'TENANT_ROUTE_INVALID_MODE',
			`Unsupported route mode "${route.routeMode}" for client ${clientId}.`,
			500
		);
	}

	return {
		clientId,
		routeMode,
		bindingName: route.bindingName?.trim() || null,
		databaseId: route.databaseId?.trim() || null,
		status: route.status?.trim().toLowerCase() || 'active',
		metadata: route.metadata ?? null
	};
};

export const getCentralDbOps = (event: DbContextEvent): DatabaseOperations => {
	const cache = getDbCache(event);
	if (cache.centralOps) {
		return cache.centralOps;
	}

	const db = requireCentralD1Database(event);
	cache.centralOps = new DatabaseOperations(db);
	return cache.centralOps;
};

const resolveFallbackCentralRoute = (clientId: string): ResolvedTenantDatabaseRoute => ({
	clientId,
	routeMode: 'central_shared',
	bindingName: null,
	databaseId: null,
	status: 'active',
	metadata: null
});

export const resolveTenantDatabaseRoute = async (
	event: DbContextEvent,
	clientId: string
): Promise<ResolvedTenantDatabaseRoute> => {
	const trimmedClientId = clientId.trim();
	if (!trimmedClientId) {
		throw new DatabaseRouteResolutionError(
			'TENANT_ROUTE_CLIENT_REQUIRED',
			'Tenant database route requires a client ID.',
			400
		);
	}

	const cache = getDbCache(event);
	const cachedRoute = cache.tenantRoutes?.get(trimmedClientId);
	if (cachedRoute) {
		return cachedRoute;
	}

	const centralDbOps = getCentralDbOps(event);
	try {
		let route = await centralDbOps.clientDatabaseRoutes.getByClientId(trimmedClientId);
		if (!route) {
			route = await centralDbOps.clientDatabaseRoutes.ensureCentralSharedRoute({
				clientId: trimmedClientId
			});
		}

		const mapped = mapRouteRecord(trimmedClientId, route) ?? resolveFallbackCentralRoute(trimmedClientId);
		if (mapped.status !== 'active') {
			throw new DatabaseRouteResolutionError(
				'TENANT_ROUTE_INACTIVE',
				`Tenant database route is not active for client ${trimmedClientId}.`,
				503
			);
		}

		cache.tenantRoutes?.set(trimmedClientId, mapped);
		return mapped;
	} catch (error) {
		if (isMissingClientRoutesTableError(error)) {
			const fallback = resolveFallbackCentralRoute(trimmedClientId);
			cache.tenantRoutes?.set(trimmedClientId, fallback);
			return fallback;
		}

		throw error;
	}
};

export const getTenantD1Database = async (
	event: DbContextEvent,
	clientId: string
): Promise<D1Database> => {
	const trimmedClientId = clientId.trim();
	const cache = getDbCache(event);
	const cachedD1 = cache.tenantD1?.get(trimmedClientId);
	if (cachedD1) {
		return cachedD1;
	}

	const route = await resolveTenantDatabaseRoute(event, trimmedClientId);
	if (route.routeMode === 'central_shared') {
		const centralDb = requireCentralD1Database(event);
		cache.tenantD1?.set(trimmedClientId, centralDb);
		return centralDb;
	}

	const bindingName = route.bindingName?.trim() ?? '';
	if (!bindingName) {
		throw new DatabaseRouteResolutionError(
			'TENANT_ROUTE_BINDING_REQUIRED',
			`Tenant route for client ${trimmedClientId} is missing binding_name.`,
			500
		);
	}

	const envRecord = event.platform?.env as Record<string, unknown> | undefined;
	const candidate = envRecord?.[bindingName];
	if (!isD1Database(candidate)) {
		throw new DatabaseRouteResolutionError(
			'TENANT_DB_BINDING_NOT_FOUND',
			`Tenant DB binding "${bindingName}" is not configured for client ${trimmedClientId}.`,
			500
		);
	}

	cache.tenantD1?.set(trimmedClientId, candidate);
	return candidate;
};

export const getTenantDbOps = async (
	event: DbContextEvent,
	clientId: string
): Promise<DatabaseOperations> => {
	const trimmedClientId = clientId.trim();
	const cache = getDbCache(event);
	const cachedOps = cache.tenantOps?.get(trimmedClientId);
	if (cachedOps) {
		return cachedOps;
	}

	const d1 = await getTenantD1Database(event, trimmedClientId);
	const centralD1 = requireCentralD1Database(event);
	const dbOps = d1 === centralD1 ? getCentralDbOps(event) : new DatabaseOperations(d1);
	cache.tenantOps?.set(trimmedClientId, dbOps);
	return dbOps;
};
