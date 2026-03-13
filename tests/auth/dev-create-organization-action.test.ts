/*
Brief description:
This file verifies that the developer page exposes the temporary create-organization action.

Deeper explanation:
The organization tools were moved off the account page, but the create flow still depends on a
page action with authentication, slug validation, membership creation, and optional session
switching. This test protects the temporary developer-page bridge so the relocated UI still submits
to a real action instead of silently losing its backend behavior.

Summary of tests:
1. It verifies that the developer page create-organization action creates the org, membership, and active session context.
2. It verifies that the action accepts participant membership when creating a test organization.
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

	it('creates an organization through the temporary developer-page bridge', async () => {
		// this proves the relocated dev-page UI still reaches the real create-organization mutation path.
		const formData = new FormData();
		formData.set('organizationName', 'Developer Org');
		formData.set('organizationSlug', 'developer-org');
		formData.set('selfJoinEnabled', '1');
		formData.set('membershipRole', 'admin');
		formData.set('switchToOrganization', '1');
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
			})
		} as any;

		const result = await actions.createOrganization(event);

		expect(result).toEqual({
			action: 'createOrganization',
			success: 'Organization "Developer Org" created and activated.'
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
		expect(mocks.dbOps.sessions.updateClientContext).toHaveBeenCalledWith(
			'session-1',
			CREATED_CLIENT_ID,
			expect.any(String)
		);
		expect(event.locals.session.activeClientId).toBe(CREATED_CLIENT_ID);
		expect(event.locals.user.clientId).toBe(CREATED_CLIENT_ID);
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
		formData.set('switchToOrganization', '1');
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
			})
		} as any;

		const result = await actions.createOrganization(event);

		expect(result).toEqual({
			action: 'createOrganization',
			success: 'Organization "Developer Org" created and activated.'
		});
		expect(mocks.dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				clientId: CREATED_CLIENT_ID,
				role: 'participant',
				isDefault: false
			})
		);
		expect(event.locals.session.role).toBe('participant');
		expect(event.locals.session.baseRole).toBe('participant');
		expect(event.locals.session.canViewAsRole).toBe(false);
		expect(event.locals.user.role).toBe('participant');
		expect(event.locals.user.baseRole).toBe('participant');
		expect(event.locals.user.canViewAsRole).toBe(false);
	});
});
