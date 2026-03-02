import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				getMembershipRecord: vi.fn(),
				countAdminLikeMembers: vi.fn(),
				updateRole: vi.fn(),
				softRemove: vi.fn()
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

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

import { DELETE, PATCH } from '../../src/routes/api/members/[membershipId]/+server';

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
		mocks.dbOps.userClients.listActiveForUser.mockResolvedValue([]);
	});

	it('blocks managers from changing member roles', async () => {
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
});
