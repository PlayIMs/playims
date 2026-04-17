/*
Brief description:
This file verifies the authorization and safety checks on member mutation routes.

Deeper explanation:
Changing roles or removing memberships can affect organization ownership and a user's ability to stay
logged into a client. These tests focus on the guardrails that prevent managers from escalating access,
prevent the last administrator from being removed, and prevent a user from deleting their only active
membership.

Summary of tests:
1. It verifies that managers cannot change member roles.
2. It verifies that the last administrator-like member cannot be deleted.
3. It verifies that a user cannot remove their only active organization membership.
4. It verifies that member profile edits can update a phone number alongside the other fields.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks ensure the route imports a fake central database layer.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				getMembershipRecord: vi.fn(),
				countAdminLikeMembers: vi.fn(),
				findActiveByStudentId: vi.fn(),
				updateProfile: vi.fn(),
				updateRole: vi.fn(),
				softRemove: vi.fn()
			},
			users: {
				getAuthByEmail: vi.fn()
			},
			userClients: {
				listActiveForUser: vi.fn(),
				setDefaultMembership: vi.fn()
			},
			sessions: {
				updateClientContext: vi.fn()
			}
		},
		getCentralDbOps: vi.fn()
	};
});

// the route remains real while every database lookup and mutation is controlled by the test.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { DELETE, PATCH } from '../../src/routes/api/members/[membershipId]/+server';

// this helper centralizes the shared auth/session envelope for member mutation requests.
const buildEvent = (role: string, userId: string, request: Request) =>
	({
		platform: { env: { DB: {} } },
		params: { membershipId: 'membership-1' },
		locals: {
			user: {
				id: userId,
				clientId: 'client-1',
				role
			},
			session: {
				id: 'session-1',
				userId,
				clientId: 'client-1',
				activeClientId: 'client-1',
				role
			}
		},
		request
	}) as any;

describe('member mutation endpoints', () => {
	beforeEach(() => {
		// these defaults represent a safe baseline that each test can override for one specific rule.
		vi.clearAllMocks();
		mocks.dbOps.members.getMembershipRecord.mockResolvedValue({
			membershipId: 'membership-1',
			clientId: 'client-1',
			userId: 'member-1',
			role: 'participant',
			status: 'active',
			email: 'member@playims.test'
		});
		mocks.dbOps.members.countAdminLikeMembers.mockResolvedValue(1);
		mocks.dbOps.members.findActiveByStudentId.mockResolvedValue(null);
		mocks.dbOps.users.getAuthByEmail.mockResolvedValue(null);
		mocks.dbOps.members.updateProfile.mockResolvedValue({
			membershipId: 'membership-1',
			clientId: 'client-1',
			userId: 'member-1',
			studentId: '12345',
			firstName: 'Jamie',
			lastName: 'Member',
			fullName: 'Jamie Member',
			email: 'member@playims.test',
			cellPhone: '+15551234567',
			lastLoginAt: null,
			sex: 'F',
			role: 'participant',
			status: 'active',
			createdAt: '2029-12-20T00:00:00.000Z',
			updatedAt: '2029-12-20T00:00:00.000Z',
			avatarUrl: null,
			lastActiveAt: null
		});
		mocks.dbOps.userClients.listActiveForUser.mockResolvedValue([]);
	});

	it('blocks managers from changing member roles', async () => {
		// role changes are reserved for stronger roles, so the route should deny this before any write.
		const response = await PATCH(
			buildEvent(
				'manager',
				'manager-1',
				new Request('https://playims.test/api/members/membership-1', {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						action: 'set-role',
						role: 'admin'
					})
				})
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe(
			'Only administrators and developers can change member roles.'
		);
		expect(mocks.dbOps.members.updateRole).not.toHaveBeenCalled();
	});

	it('prevents deleting the last admin-like member', async () => {
		// count admin-like members returning zero means this membership is the last elevated safety net.
		mocks.dbOps.members.getMembershipRecord.mockResolvedValue({
			membershipId: 'membership-1',
			clientId: 'client-1',
			userId: 'member-1',
			role: 'admin',
			status: 'active',
			email: 'admin@playims.test'
		});
		mocks.dbOps.members.countAdminLikeMembers.mockResolvedValue(0);

		const response = await DELETE(
			buildEvent(
				'admin',
				'admin-actor',
				new Request('https://playims.test/api/members/membership-1', {
					method: 'DELETE'
				})
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe('You cannot remove the last administrator.');
		expect(mocks.dbOps.members.softRemove).not.toHaveBeenCalled();
	});

	it('prevents a user from removing their only active organization membership', async () => {
		// deleting the final active membership would strand the user outside any organization context.
		mocks.dbOps.members.getMembershipRecord.mockResolvedValue({
			membershipId: 'membership-1',
			clientId: 'client-1',
			userId: 'user-1',
			role: 'participant',
			status: 'active',
			email: 'self@playims.test'
		});
		mocks.dbOps.userClients.listActiveForUser.mockResolvedValue([
			{
				id: 'membership-1',
				userId: 'user-1',
				clientId: 'client-1',
				role: 'participant',
				status: 'active'
			}
		]);

		const response = await DELETE(
			buildEvent(
				'admin',
				'user-1',
				new Request('https://playims.test/api/members/membership-1', {
					method: 'DELETE'
				})
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe(
			'You cannot remove your only active organization membership.'
		);
		expect(mocks.dbOps.members.softRemove).not.toHaveBeenCalled();
	});

	it('updates a member profile phone number through the edit endpoint', async () => {
		// the route should carry the phone value through to the member operation without dropping the rest of the profile edit.
		const response = await PATCH(
			buildEvent(
				'admin',
				'admin-actor',
				new Request('https://playims.test/api/members/membership-1', {
					method: 'PATCH',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						action: 'edit-profile',
						email: 'member@playims.test',
						cellPhone: '+1 (555) 123-4567',
						firstName: 'Jamie',
						lastName: 'Member',
						studentId: '12345',
						sex: 'F'
					})
				})
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.dbOps.members.updateProfile).toHaveBeenCalledWith(
			expect.objectContaining({
				cellPhone: '+1 (555) 123-4567',
				sex: 'F',
				email: 'member@playims.test'
			})
		);
	});
});
