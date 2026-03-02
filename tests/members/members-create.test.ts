import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				findActiveByStudentId: vi.fn(),
				addOrReactivateMember: vi.fn(),
				getPendingInviteByEmail: vi.fn(),
				createInvite: vi.fn()
			}
		},
		getCentralDbOps: vi.fn(),
		hashMemberInviteToken: vi.fn()
	};
});

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/members/invites', () => ({
	generateMemberInviteToken: () => 'invite-token',
	hashMemberInviteToken: mocks.hashMemberInviteToken,
	getMemberInviteExpiryIso: () => '2030-01-01T00:00:00.000Z',
	buildMemberInviteUrl: (origin: string, token: string) =>
		`${origin}/accept-member-invite/${token}`
}));

import { POST } from '../../src/routes/api/members/+server';

const buildEvent = (role: string, body: Record<string, unknown>) =>
	({
		platform: { env: { DB: {} } },
		url: new URL('https://playims.test/api/members'),
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role
			}
		},
		request: new Request('https://playims.test/api/members', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as any;

describe('members create endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hashMemberInviteToken.mockResolvedValue('invite-hash');
		mocks.dbOps.members.findActiveByStudentId.mockResolvedValue(null);
		mocks.dbOps.members.addOrReactivateMember.mockResolvedValue({ status: 'user-not-found' });
		mocks.dbOps.members.getPendingInviteByEmail.mockResolvedValue(null);
		mocks.dbOps.members.createInvite.mockResolvedValue(null);
	});

	it('rejects add-member attempts from managers', async () => {
		const response = await POST(
			buildEvent('manager', {
				mode: 'invite',
				email: 'new@playims.test',
				role: 'participant'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe('Only administrators and developers can add members.');
		expect(mocks.dbOps.members.addOrReactivateMember).not.toHaveBeenCalled();
	});

	it('rejects duplicate student IDs inside the same organization', async () => {
		mocks.dbOps.members.findActiveByStudentId.mockResolvedValue('membership-2');

		const response = await POST(
			buildEvent('admin', {
				mode: 'preprovision',
				email: 'new@playims.test',
				role: 'participant',
				firstName: 'Jamie',
				lastName: 'Member',
				studentId: '12345',
				sex: 'F'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe(
			'Student ID already belongs to another member in this organization.'
		);
		expect(mocks.dbOps.members.addOrReactivateMember).not.toHaveBeenCalled();
	});

	it('creates an invite link when the email does not belong to an existing user', async () => {
		mocks.dbOps.members.createInvite.mockResolvedValue({
			inviteId: 'invite-1',
			email: 'new@playims.test',
			firstName: 'Jamie',
			lastName: 'Member',
			studentId: '12345',
			sex: 'F',
			role: 'participant',
			mode: 'preprovision',
			status: 'pending',
			expiresAt: '2030-01-01T00:00:00.000Z',
			createdAt: '2029-12-20T00:00:00.000Z'
		});

		const response = await POST(
			buildEvent('admin', {
				mode: 'preprovision',
				email: 'new@playims.test',
				role: 'participant',
				firstName: 'Jamie',
				lastName: 'Member',
				studentId: '12345',
				sex: 'F'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.addedExistingUser).toBe(false);
		expect(payload.data.invite.inviteUrl).toBe(
			'https://playims.test/accept-member-invite/invite-token'
		);
		expect(mocks.dbOps.members.createInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				clientId: 'client-1',
				email: 'new@playims.test',
				tokenHash: 'invite-hash',
				createdUser: 'user-1'
			})
		);
	});
});
