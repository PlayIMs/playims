/*
Brief description:
This file verifies the dashboard organization settings page load and save action.

Deeper explanation:
The organization settings page is the new first-class place to edit current-organization profile
details. That means the server route now owns both the initial page payload and the mutation path
for updating organization identity fields. These tests protect the permission model, duplicate-slug
guard, and current-organization targeting so admins can safely update org details without opening
write access to read-only viewers.

Summary of tests:
1. It verifies that the page load returns the active organization details in read-only mode for managers.
2. It verifies that admins can save organization settings for the active organization.
3. It verifies that write attempts are blocked while viewing the dashboard as a lower role.
4. It verifies that duplicate organization slugs are rejected before saving.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ACTIVE_CLIENT_ID = '11111111-1111-4111-8111-111111111111';

// these hoisted mocks keep the page server module wired to a controllable central database layer.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			clients: {
				getById: vi.fn(),
				getByNormalizedSlug: vi.fn(),
				updateDetails: vi.fn()
			},
			userClients: {
				getActiveMembership: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

// the real load and action logic stay under test while persistence is fully mocked.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { actions, load } from '../../src/routes/dashboard/settings/organization/+page.server';

const buildLocals = (input?: {
	role?: string;
	baseRole?: string;
	isViewingAsRole?: boolean;
	viewAsRole?: string | null;
}) => ({
	user: {
		id: 'user-1',
		clientId: ACTIVE_CLIENT_ID,
		role: input?.role ?? 'admin',
		baseRole: input?.baseRole ?? input?.role ?? 'admin',
		canViewAsRole: true,
		isViewingAsRole: input?.isViewingAsRole ?? false,
		viewAsRole: input?.viewAsRole ?? null
	},
	session: {
		id: 'session-1',
		userId: 'user-1',
		clientId: ACTIVE_CLIENT_ID,
		activeClientId: ACTIVE_CLIENT_ID,
		role: input?.role ?? 'admin',
		baseRole: input?.baseRole ?? input?.role ?? 'admin',
		canViewAsRole: true,
		isViewingAsRole: input?.isViewingAsRole ?? false,
		viewAsRole: input?.viewAsRole ?? null
	}
});

// this helper keeps the authenticated load event focused on route behavior instead of setup noise.
const buildLoadEvent = (input?: {
	role?: string;
	baseRole?: string;
	isViewingAsRole?: boolean;
	viewAsRole?: string | null;
}) =>
	({
		platform: { env: { DB: {} } },
		locals: buildLocals(input)
	}) as any;

// this helper creates a real form post so the page action exercises form-data parsing exactly as shipped.
const buildActionEvent = (
	formData: FormData,
	input?: {
		role?: string;
		baseRole?: string;
		isViewingAsRole?: boolean;
		viewAsRole?: string | null;
	}
) =>
	({
		platform: { env: { DB: {} } },
		locals: buildLocals(input),
		request: new Request('https://playims.test/dashboard/settings/organization?/saveOrganization', {
			method: 'POST',
			body: formData
		})
	}) as any;

describe('dashboard organization settings page', () => {
	beforeEach(() => {
		// these defaults describe the current active organization and an admin membership that can edit it.
		vi.clearAllMocks();
		mocks.dbOps.clients.getById.mockResolvedValue({
			id: ACTIVE_CLIENT_ID,
			name: 'Campus Recreation',
			slug: 'campus-rec',
			status: 'active',
			selfJoinEnabled: 1,
			metadata: '{"contactEmail":"rec@playims.test"}',
			createdAt: '2029-01-10T00:00:00.000Z',
			updatedAt: '2029-02-01T15:30:00.000Z',
			createdUser: 'seed-user',
			updatedUser: 'admin-user'
		});
		mocks.dbOps.userClients.getActiveMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: ACTIVE_CLIENT_ID,
			role: 'admin',
			isDefault: 1
		});
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue(null);
		mocks.dbOps.clients.updateDetails.mockResolvedValue({
			id: ACTIVE_CLIENT_ID,
			name: 'Campus Recreation',
			slug: 'campus-rec',
			selfJoinEnabled: 1,
			metadata: '{"contactEmail":"rec@playims.test"}'
		});
	});

	it('returns the active organization details in read-only mode for managers', async () => {
		// managers can view settings, but they should not receive edit capability for org identity fields.
		mocks.dbOps.userClients.getActiveMembership.mockResolvedValue({
			userId: 'user-1',
			clientId: ACTIVE_CLIENT_ID,
			role: 'manager',
			isDefault: 1
		});

		const result = await load(
			buildLoadEvent({
				role: 'manager',
				baseRole: 'manager'
			})
		);

		expect(result.canEditOrganization).toBe(false);
		expect(result.readOnlyMessage).toBe(
			'Only administrators and developers can update organization settings.'
		);
		expect(result.organization).toMatchObject({
			id: ACTIVE_CLIENT_ID,
			name: 'Campus Recreation',
			slug: 'campus-rec',
			status: 'active',
			selfJoinEnabled: true,
			joinPath: '/campus-rec'
		});
		expect(result.membership).toMatchObject({
			role: 'manager',
			isDefault: true
		});
	});

	it('saves organization settings for the active organization when the viewer can mutate', async () => {
		// the action should target only the current org from session context and persist cleaned values.
		const formData = new FormData();
		formData.set('organizationName', 'Campus Recreation and Wellness');
		formData.set('organizationSlug', ' Campus Recreation and Wellness ');
		formData.set('selfJoinEnabled', '1');
		formData.set('metadata', '{ "contactEmail": "wellness@playims.test" }');

		const result = await actions.saveOrganization(buildActionEvent(formData));

		expect(result).toEqual({
			action: 'saveOrganization',
			success: 'Organization settings updated.'
		});
		expect(mocks.dbOps.clients.updateDetails).toHaveBeenCalledWith(
			ACTIVE_CLIENT_ID,
			{
				name: 'Campus Recreation and Wellness',
				slug: 'campus-recreation-and-wellness',
				selfJoinEnabled: true,
				metadata: '{ "contactEmail": "wellness@playims.test" }'
			},
			'user-1'
		);
	});

	it('blocks write attempts while viewing as a lower role', async () => {
		// mutate-aware permission checks should honor the viewed role, not only the stored base role.
		const formData = new FormData();
		formData.set('organizationName', 'Campus Recreation');
		formData.set('organizationSlug', 'campus-rec');
		formData.set('selfJoinEnabled', '0');

		const result = await actions.saveOrganization(
			buildActionEvent(formData, {
				role: 'manager',
				baseRole: 'admin',
				isViewingAsRole: true,
				viewAsRole: 'manager'
			})
		);

		expect(result).toMatchObject({
			status: 403,
			data: {
				action: 'saveOrganization',
				error: 'You do not have permission to update settings in the current view mode.'
			}
		});
		expect(mocks.dbOps.clients.updateDetails).not.toHaveBeenCalled();
	});

	it('rejects duplicate organization slugs before saving', async () => {
		// duplicate slug protection keeps public org routes and self-join links unique across tenants.
		mocks.dbOps.clients.getByNormalizedSlug.mockResolvedValue({
			id: 'different-client-id'
		});

		const formData = new FormData();
		formData.set('organizationName', 'Campus Recreation');
		formData.set('organizationSlug', 'shared-slug');
		formData.set('selfJoinEnabled', '1');

		const result = await actions.saveOrganization(buildActionEvent(formData));

		expect(result).toMatchObject({
			status: 409,
			data: {
				action: 'saveOrganization',
				error: 'That organization slug is already in use.',
				fieldErrors: {
					organizationSlug: 'That organization slug is already in use.'
				}
			}
		});
		expect(mocks.dbOps.clients.updateDetails).not.toHaveBeenCalled();
	});
});
