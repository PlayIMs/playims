/*
Brief description:
This file verifies the organization-management API routes for updating, defaulting, and leaving organizations.

Deeper explanation:
These routes do more than validate payloads. They coordinate membership permissions, slug validation,
default organization state, and live session switching when a user leaves their current organization.
That makes them high-risk for subtle regressions that can leave a user in the wrong org context or
break self-service organization management.

Summary of tests:
1. It verifies that the set-default action updates the default organization for an authorized membership.
2. It verifies that update-details is blocked for non-admin memberships.
3. It verifies that update-details rejects duplicate organization slugs.
4. It verifies that leaving an organization rejects an incorrect confirmation slug.
5. It verifies that leaving the current default organization switches the active session and assigns a fallback default.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACTIVE_CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const FALLBACK_CLIENT_ID = '22222222-2222-4222-8222-222222222222';

// these hoisted mocks let the route module import a fake central database layer during evaluation.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			userClients: {
				getActiveMembership: vi.fn(),
				setDefaultMembership: vi.fn(),
				listActiveForUser: vi.fn(),
				deactivateMembership: vi.fn()
			},
			clients: {
				getById: vi.fn(),
				getByNormalizedSlug: vi.fn(),
				updateDetails: vi.fn()
			},
			sessions: {
				updateClientContext: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

// the route remains real while its persistence layer is fully controlled by the test fixtures below.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { DELETE, PATCH } from '../../src/routes/api/auth/organizations/+server';

// this helper builds authenticated request events and keeps each test focused on the route branch it needs.
const createEvent = (input?: {
	method?: 'PATCH' | 'DELETE';
	body?: unknown;
	role?: string;
	withDb?: boolean;
}) => {
	const method = input?.method ?? 'PATCH';
	const url = new URL('https://playims.test/api/auth/organizations');
	return {
		url,
		request: new Request(url, {
			method,
			headers: { 'content-type': 'application/json' },
			body: input?.body !== undefined ? JSON.stringify(input.body) : undefined
		}),
		platform: input?.withDb === false ? { env: {} } : { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: ACTIVE_CLIENT_ID,
				role: input?.role ?? 'admin',
				baseRole: input?.role ?? 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: ACTIVE_CLIENT_ID,
				activeClientId: ACTIVE_CLIENT_ID,
				role: input?.role ?? 'admin',
				baseRole: input?.role ?? 'admin',
				canViewAsRole: true,
				isViewingAsRole: false,
				viewAsRole: null
			}
		}
	} as any;
};

describe('organization routes', () => {
	beforeEach(() => {
		// these defaults represent the simplest authorized organization-management path.
		vi.clearAllMocks();
		mocks.dbOps.userClients.getActiveMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: ACTIVE_CLIENT_ID,
			role: 'admin',
			isDefault: 1
		});
		mocks.dbOps.userClients.setDefaultMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: FALLBACK_CLIENT_ID,
			isDefault: 1
		});
		mocks.dbOps.userClients.listActiveForUser.mockResolvedValue([
			{
				userId: 'user-1',
				clientId: ACTIVE_CLIENT_ID,
				role: 'admin',
				isDefault: 1
			},
			{
				userId: 'user-1',
				clientId: FALLBACK_CLIENT_ID,
				role: 'manager',
				isDefault: 0
			}
		]);
		mocks.dbOps.userClients.deactivateMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: ACTIVE_CLIENT_ID
		});
		mocks.dbOps.clients.getById.mockResolvedValue({
			id: ACTIVE_CLIENT_ID,
			name: 'Org One',
			slug: 'org-one'
		});
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue(null);
		mocks.dbOps.clients.updateDetails.mockResolvedValue({
			id: ACTIVE_CLIENT_ID,
			slug: 'org-one'
		});
		mocks.dbOps.sessions.updateClientContext.mockResolvedValue({
			id: 'session-1'
		});
	});

	it('updates the default organization for an authorized membership', async () => {
		// this is the lightest success path and proves the route returns the expected default context.
		const response = await PATCH(
			createEvent({
				body: {
					action: 'set-default',
					clientId: FALLBACK_CLIENT_ID
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: {
				clientId: FALLBACK_CLIENT_ID,
				activeClientId: ACTIVE_CLIENT_ID,
				defaultClientId: FALLBACK_CLIENT_ID
			}
		});
		expect(mocks.dbOps.userClients.setDefaultMembership).toHaveBeenCalledWith(
			'user-1',
			FALLBACK_CLIENT_ID
		);
	});

	it('blocks update-details for memberships without admin-like permissions', async () => {
			// organization settings should only be editable by admin-like roles even if the membership exists.
			mocks.dbOps.userClients.getActiveMembership.mockResolvedValue({
				userId: 'user-1',
				clientId: ACTIVE_CLIENT_ID,
				role: 'participant'
			});

		const response = await PATCH(
			createEvent({
				body: {
					action: 'update-details',
					clientId: ACTIVE_CLIENT_ID,
					organizationName: 'Org One',
					organizationSlug: 'org-one',
					selfJoinEnabled: true,
					metadata: 'notes'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe('Only administrators and developers can edit organization settings.');
		expect(mocks.dbOps.clients.updateDetails).not.toHaveBeenCalled();
	});

	it('rejects duplicate organization slugs during update-details', async () => {
		// duplicate slug checks protect organization routing and self-join lookups from collisions.
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue({
			id: 'different-client'
		});

		const response = await PATCH(
			createEvent({
				body: {
					action: 'update-details',
					clientId: ACTIVE_CLIENT_ID,
					organizationName: 'Org One',
					organizationSlug: 'org-two',
					selfJoinEnabled: false,
					metadata: 'notes'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('That organization slug is already in use.');
		expect(payload.fieldErrors.organizationSlug).toEqual(['That organization slug is already in use.']);
	});

	it('rejects leaving an organization when the confirmation slug does not match', async () => {
		// the confirm slug is the safety check that prevents accidental self-removal from an organization.
		const response = await DELETE(
			createEvent({
				method: 'DELETE',
				body: {
					clientId: ACTIVE_CLIENT_ID,
					confirmSlug: 'wrong-slug'
				}
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.error).toBe('Organization slug confirmation did not match.');
		expect(mocks.dbOps.userClients.deactivateMembership).not.toHaveBeenCalled();
	});

	it('switches the active session and fallback default when leaving the current organization', async () => {
		// this is the highest-risk branch because it mutates memberships, defaults, and live session locals together.
		mocks.dbOps.clients.getById.mockResolvedValue({
			id: ACTIVE_CLIENT_ID,
			name: 'Org One',
			slug: 'org-one'
		});
		mocks.dbOps.userClients.listActiveForUser.mockResolvedValue([
			{
				userId: 'user-1',
				clientId: ACTIVE_CLIENT_ID,
				role: 'admin',
				isDefault: 1
			},
			{
				userId: 'user-1',
				clientId: FALLBACK_CLIENT_ID,
				role: 'manager',
				isDefault: 0
			}
		]);
		mocks.dbOps.userClients.setDefaultMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: FALLBACK_CLIENT_ID,
			isDefault: 1
		});

		const event = createEvent({
			method: 'DELETE',
			body: {
				clientId: ACTIVE_CLIENT_ID,
				confirmSlug: 'org-one'
			}
		});
		const response = await DELETE(event);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: {
				clientId: ACTIVE_CLIENT_ID,
				activeClientId: FALLBACK_CLIENT_ID,
				defaultClientId: FALLBACK_CLIENT_ID
			}
		});
		expect(mocks.dbOps.sessions.updateClientContext).toHaveBeenCalledWith(
			'session-1',
			FALLBACK_CLIENT_ID,
			expect.any(String)
		);
		expect(event.locals.session.activeClientId).toBe(FALLBACK_CLIENT_ID);
		expect(event.locals.session.role).toBe('manager');
		expect(event.locals.user.clientId).toBe(FALLBACK_CLIENT_ID);
		expect(event.locals.user.role).toBe('manager');
	});
});
