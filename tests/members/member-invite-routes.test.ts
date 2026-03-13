/*
Brief description:
This file verifies the API routes that list, revoke, and regenerate member invites.

Deeper explanation:
Member invites are an admin-controlled workflow that mixes authorization, token regeneration, and
user-facing invite URLs. These tests protect the route-level decisions around who can manage invites,
how missing invites fail, and what response shape the dashboard receives for invite lists and invite
regeneration.

Summary of tests:
1. It verifies that the pending invite list returns rows and records request-log metadata.
2. It verifies that non-admin users cannot manage invite records.
3. It verifies that revoking a missing invite returns 404.
4. It verifies that regenerating an invite returns the new invite record and invite URL.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks let the invite routes import fake database and token helpers during module load.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				listPendingInvites: vi.fn(),
				revokeInvite: vi.fn(),
				regenerateInvite: vi.fn()
			}
		},
		getCentralDbOps: vi.fn(),
		generateMemberInviteToken: vi.fn(),
		hashMemberInviteToken: vi.fn(),
		getMemberInviteExpiryIso: vi.fn(),
		buildMemberInviteUrl: vi.fn()
	};
});

// the routes stay real, but all persistence and token generation behavior is controlled by the test.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/members/invites', () => ({
	generateMemberInviteToken: mocks.generateMemberInviteToken,
	hashMemberInviteToken: mocks.hashMemberInviteToken,
	getMemberInviteExpiryIso: mocks.getMemberInviteExpiryIso,
	buildMemberInviteUrl: mocks.buildMemberInviteUrl
}));

import { GET as listInvites } from '../../src/routes/api/member-invites/+server';
import { PATCH as manageInvite } from '../../src/routes/api/member-invites/[inviteId]/+server';

// this helper creates an authenticated route event and lets each test swap roles or payloads easily.
const createEvent = (input?: {
	role?: string;
	body?: unknown;
	path?: string;
	inviteId?: string;
	withDb?: boolean;
}) => {
	const path = input?.path ?? '/api/member-invites/invite-1';
	const url = new URL(`https://playims.test${path}`);
	return {
		url,
		request: new Request(url, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: input?.body !== undefined ? JSON.stringify(input.body) : undefined
		}),
		params: {
			inviteId: input?.inviteId ?? 'invite-1'
		},
		platform: input?.withDb === false ? { env: {} } : { env: { DB: {} } },
		locals: {
			user: {
				id: 'user-1',
				clientId: 'client-1',
				role: input?.role ?? 'admin'
			},
			session: {
				id: 'session-1',
				userId: 'user-1',
				clientId: 'client-1',
				activeClientId: 'client-1',
				role: input?.role ?? 'admin'
			},
			requestLogMeta: undefined
		}
	} as any;
};

describe('member invite routes', () => {
	beforeEach(() => {
		// the defaults below represent the simplest successful invite-management flow.
		vi.clearAllMocks();
		mocks.dbOps.members.listPendingInvites.mockResolvedValue([
			{ inviteId: 'invite-1', email: 'pending@playims.test' }
		]);
		mocks.dbOps.members.revokeInvite.mockResolvedValue({ id: 'invite-1' });
		mocks.dbOps.members.regenerateInvite.mockResolvedValue({
			inviteId: 'invite-1',
			email: 'pending@playims.test'
		});
		mocks.generateMemberInviteToken.mockReturnValue('fresh-token');
		mocks.hashMemberInviteToken.mockResolvedValue('invite-hash');
		mocks.getMemberInviteExpiryIso.mockReturnValue('2030-01-01T00:00:00.000Z');
		mocks.buildMemberInviteUrl.mockImplementation(
			(origin: string, token: string) => `${origin}/accept-member-invite/${token}`
		);
	});

	it('returns pending invite rows and records request-log metadata', async () => {
		// the list route should mirror the row count into request logging for downstream observability.
		const event = createEvent({
			path: '/api/member-invites'
		});
		const response = await listInvites(event);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.rows).toHaveLength(1);
		expect(event.locals.requestLogMeta).toEqual({
			table: 'member_invites',
			recordCount: 1
		});
	});

	it('blocks non-admin users from managing invite records', async () => {
		// invite revocation and regeneration should stay restricted to administrator-like roles.
		const response = await manageInvite(
			createEvent({
				role: 'manager',
				body: { action: 'revoke' }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe('Only administrators and developers can manage invites.');
		expect(mocks.dbOps.members.revokeInvite).not.toHaveBeenCalled();
	});

	it('returns 404 when revoking an invite that does not exist', async () => {
		// a missing invite should fail cleanly without pretending the revoke succeeded.
		mocks.dbOps.members.revokeInvite.mockResolvedValue(null);

		const response = await manageInvite(
			createEvent({
				body: { action: 'revoke' }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.error).toBe('Unable to revoke invite.');
	});

	it('regenerates an invite and returns the new invite url', async () => {
		// this protects the contract between token regeneration, hashing, and the user-facing invite url.
		const response = await manageInvite(
			createEvent({
				body: { action: 'regenerate' }
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			success: true,
			data: {
				invite: {
					inviteId: 'invite-1',
					email: 'pending@playims.test'
				},
				inviteUrl: 'https://playims.test/accept-member-invite/fresh-token',
				action: 'regenerate'
			}
		});
		expect(mocks.hashMemberInviteToken).toHaveBeenCalledWith('fresh-token');
		expect(mocks.dbOps.members.regenerateInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				inviteId: 'invite-1',
				clientId: 'client-1',
				tokenHash: 'invite-hash'
			})
		);
	});
});
