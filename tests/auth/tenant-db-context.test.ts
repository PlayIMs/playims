/*
Brief description:
This file verifies how tenant database routes are resolved for client-specific data access.

Deeper explanation:
PlayIMs can route a client to the shared central database or to a dedicated D1 binding. The helper
has to interpret route records, detect inactive or missing bindings, and recover safely when the
routing table does not exist yet. These tests protect that decision tree directly because many server
operations depend on it.

Summary of tests:
1. It verifies that missing route records default to the central shared database.
2. It verifies that explicit central shared routes resolve successfully.
3. It verifies that active D1 binding routes return the configured tenant binding.
4. It verifies that missing D1 bindings raise the expected resolution error.
5. It verifies that inactive routes are rejected.
6. It verifies that missing routing tables fall back to the central shared database even through nested causes.
*/

import { describe, expect, it, vi } from 'vitest';
import {
	DatabaseRouteResolutionError,
	getTenantD1Database,
	resolveTenantDatabaseRoute
} from '../../src/lib/server/database/context';

const createFakeD1 = () =>
	({
		prepare: vi.fn()
	}) as any;

// this helper builds the cached event shape expected by the tenant-routing helpers.
const createEvent = (route: {
	routeMode: string;
	bindingName?: string | null;
	status?: string | null;
} | null) => {
	const centralDb = createFakeD1();
	const tenantDb = createFakeD1();

	return {
		platform: {
			env: {
				DB: centralDb,
				TENANT_A: tenantDb
			}
		},
		locals: {
			__dbCache: {
				centralOps: {
					clientDatabaseRoutes: {
						getByClientId: vi.fn().mockResolvedValue(route),
						ensureCentralSharedRoute: vi.fn().mockResolvedValue(route)
					}
				},
				tenantOps: new Map(),
				tenantD1: new Map(),
				tenantRoutes: new Map()
			}
		}
	} as any;
};

// the real d1 and drizzle error chain is nested, so this helper mirrors that shape closely.
const createWrappedMissingTableError = () => {
	const sqliteError = new Error('no such table: client_database_routes: SQLITE_ERROR');
	const d1Error = new Error('D1_ERROR: no such table: client_database_routes: SQLITE_ERROR');
	(d1Error as { cause?: unknown }).cause = sqliteError;

	const drizzleError = new Error(
		'Failed query: select ... from "client_database_routes" where "client_id" = ?'
	);
	(drizzleError as { cause?: unknown }).cause = d1Error;
	return drizzleError;
};

describe('tenant database context', () => {
	it('defaults to central_shared route when no route record exists', async () => {
		// null here means the client has not been assigned a route yet, so the helper should self-heal.
		const event = createEvent(null);

		const resolved = await resolveTenantDatabaseRoute(
			event,
			'11111111-1111-4111-8111-111111111111'
		);

		expect(resolved.routeMode).toBe('central_shared');
		expect(resolved.status).toBe('active');
	});

	it('resolves explicit central_shared route', async () => {
		// this confirms an explicit central route behaves the same as the default fallback.
		const event = createEvent({
			routeMode: 'central_shared',
			status: 'active',
			bindingName: null
		});

		const resolved = await resolveTenantDatabaseRoute(
			event,
			'22222222-2222-4222-8222-222222222222'
		);

		expect(resolved.routeMode).toBe('central_shared');
	});

	it('resolves d1_binding route when binding exists', async () => {
		// this is the tenant-isolated happy path where the configured binding should be returned directly.
		const event = createEvent({
			routeMode: 'd1_binding',
			status: 'active',
			bindingName: 'TENANT_A'
		});

		const resolvedDb = await getTenantD1Database(event, '33333333-3333-4333-8333-333333333333');
		expect(resolvedDb).toBe(event.platform.env.TENANT_A);
	});

	it('fails when d1_binding is configured but binding is missing', async () => {
		// a configured-but-missing binding is dangerous because it would silently misroute tenant data.
		const event = createEvent({
			routeMode: 'd1_binding',
			status: 'active',
			bindingName: 'TENANT_MISSING'
		});

		await expect(
			getTenantD1Database(event, '44444444-4444-4444-8444-444444444444')
		).rejects.toMatchObject({
			code: 'TENANT_DB_BINDING_NOT_FOUND'
		} satisfies Partial<DatabaseRouteResolutionError>);
	});

	it('fails when route exists but is not active', async () => {
		// inactive routes should not be used even if the route row itself exists.
		const event = createEvent({
			routeMode: 'central_shared',
			status: 'inactive'
		});

		await expect(
			resolveTenantDatabaseRoute(event, '55555555-5555-4555-8555-555555555555')
		).rejects.toMatchObject({
			code: 'TENANT_ROUTE_INACTIVE'
		} satisfies Partial<DatabaseRouteResolutionError>);
	});

	it('falls back to central_shared when missing routes table is wrapped in nested causes', async () => {
		// this protects first-run and partially migrated environments where the routing table may not exist yet.
		const event = createEvent(null);
		event.locals.__dbCache.centralOps.clientDatabaseRoutes.getByClientId = vi
			.fn()
			.mockRejectedValue(createWrappedMissingTableError());

		const resolved = await resolveTenantDatabaseRoute(
			event,
			'66666666-6666-4666-8666-666666666666'
		);

		expect(resolved.routeMode).toBe('central_shared');
		expect(resolved.status).toBe('active');
	});
});
