/*
Brief description:
This file verifies that the developer page exposes the current create-organization action.

Deeper explanation:
The developer tools page owns the current organization create flow. That flow still depends on a
page action with authentication, slug validation, membership creation, and optional session
switching. These tests protect that server path so the UI cannot drift away from the backend
behavior that actually creates and activates an organization.

Summary of tests:
1. It verifies that the developer page create-organization action can create an organization without switching away from the page.
2. It verifies that the action accepts participant membership when creating a test organization.
3. It verifies that the action redirects to the dashboard when a switched organization cannot access the current developer route.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const CREATED_CLIENT_ID = '33333333-3333-4333-8333-333333333333';

// these hoisted mocks keep the page action connected to a fake central database layer during import.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			clients: {
				getByNormalizedSlug: vi.fn(),
				create: vi.fn()
			},
			userClients: {
				ensureMembership: vi.fn()
			},
			sessions: {
				updateClientContext: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

// the page action remains real while all persistent effects are controlled by the test fixtures below.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { actions } from '../../src/routes/dashboard/dev/+page.server';

describe('developer page create-organization action', () => {
	beforeEach(() => {
		// these defaults represent the happy path where the new organization becomes active immediately.
		vi.clearAllMocks();
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue(null);
		mocks.dbOps.clients.create.mockResolvedValue({
			id: CREATED_CLIENT_ID,
			name: 'Developer Org',
			slug: 'developer-org'
		});
		mocks.dbOps.userClients.ensureMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: CREATED_CLIENT_ID,
			role: 'admin'
		});
		mocks.dbOps.sessions.updateClientContext.mockResolvedValue({
			id: 'session-1'
		});
	});

	it('creates an organization through the developer tools page action without switching contexts', async () => {
		// this proves the dev-page UI still reaches the real create-organization mutation path when no redirect is needed.
		const formData = new FormData();
		formData.set('organizationName', 'Developer Org');
		formData.set('organizationSlug', 'developer-org');
		formData.set('selfJoinEnabled', '1');
		formData.set('membershipRole', 'admin');
		formData.set('switchToOrganization', '0');
		formData.set('setDefaultOrganization', '1');
		formData.set('metadata', '{"source":"dev-page"}');

		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: 'client-1',
					role: 'admin',
					baseRole: 'admin',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: 'client-1',
					activeClientId: 'client-1',
					role: 'admin',
					baseRole: 'admin',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				}
			},
			request: new Request('https://playims.test/dashboard/dev?/createOrganization', {
				method: 'POST',
				body: formData
			}),
			url: new URL('https://playims.test/dashboard/dev?/createOrganization')
		} as any;

		const result = await actions.createOrganization(event);

		expect(result).toEqual({
			action: 'createOrganization',
			success: 'Organization "Developer Org" created.'
		});
		expect(mocks.dbOps.clients.create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Developer Org',
				slug: 'developer-org',
				selfJoinEnabled: true,
				createdUser: 'user-1',
				updatedUser: 'user-1'
			})
		);
		expect(mocks.dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: CREATED_CLIENT_ID,
				role: 'admin',
				isDefault: true
			})
		);
		expect(mocks.dbOps.sessions.updateClientContext).not.toHaveBeenCalled();
		expect(event.locals.session.activeClientId).toBe('client-1');
		expect(event.locals.user.clientId).toBe('client-1');
	});

	it('accepts participant membership for a newly created organization', async () => {
		// this keeps the testing flow available when someone needs a low-privilege org membership on purpose.
		mocks.dbOps.userClients.ensureMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: CREATED_CLIENT_ID,
			role: 'participant'
		});

		const formData = new FormData();
		formData.set('organizationName', 'Participant Sandbox');
		formData.set('organizationSlug', 'participant-sandbox');
		formData.set('selfJoinEnabled', '0');
		formData.set('membershipRole', 'participant');
		formData.set('switchToOrganization', '0');
		formData.set('setDefaultOrganization', '0');

		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: 'client-1',
					role: 'admin',
					baseRole: 'admin',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: 'client-1',
					activeClientId: 'client-1',
					role: 'admin',
					baseRole: 'admin',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				}
			},
			request: new Request('https://playims.test/dashboard/dev?/createOrganization', {
				method: 'POST',
				body: formData
			}),
			url: new URL('https://playims.test/dashboard/dev?/createOrganization')
		} as any;

		const result = await actions.createOrganization(event);

		expect(result).toEqual({
			action: 'createOrganization',
			success: 'Organization "Developer Org" created.'
		});
		expect(mocks.dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: CREATED_CLIENT_ID,
				role: 'participant',
				isDefault: false
			})
		);
		expect(mocks.dbOps.sessions.updateClientContext).not.toHaveBeenCalled();
		expect(event.locals.session.role).toBe('admin');
		expect(event.locals.session.baseRole).toBe('admin');
		expect(event.locals.session.canViewAsRole).toBe(true);
		expect(event.locals.user.role).toBe('admin');
		expect(event.locals.user.baseRole).toBe('admin');
		expect(event.locals.user.canViewAsRole).toBe(true);
	});

	it('redirects to the dashboard when the switched organization cannot access the developer page', async () => {
		// this protects the exact failure path where a successful switch would otherwise reload into a 403 page.
		const formData = new FormData();
		formData.set('organizationName', 'Restricted Org');
		formData.set('organizationSlug', 'restricted-org');
		formData.set('selfJoinEnabled', '0');
		formData.set('membershipRole', 'admin');
		formData.set('switchToOrganization', '1');
		formData.set('setDefaultOrganization', '1');

		const event = {
			platform: { env: { DB: {} } },
			locals: {
				user: {
					id: 'user-1',
					clientId: 'client-1',
					role: 'dev',
					baseRole: 'dev',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				},
				session: {
					id: 'session-1',
					userId: 'user-1',
					clientId: 'client-1',
					activeClientId: 'client-1',
					role: 'dev',
					baseRole: 'dev',
					canViewAsRole: true,
					isViewingAsRole: false,
					viewAsRole: null
				}
			},
			request: new Request('https://playims.test/dashboard/dev?/createOrganization', {
				method: 'POST',
				body: formData
			}),
			url: new URL('https://playims.test/dashboard/dev?/createOrganization')
		} as any;

		await expect(actions.createOrganization(event)).rejects.toMatchObject({
			status: 303,
			location: '/dashboard'
		});
		expect(event.locals.session.activeClientId).toBe(CREATED_CLIENT_ID);
		expect(event.locals.session.role).toBe('admin');
		expect(event.locals.user.clientId).toBe(CREATED_CLIENT_ID);
		expect(event.locals.user.role).toBe('admin');
	});
});
