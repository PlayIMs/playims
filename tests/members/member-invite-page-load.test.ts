/*
Brief description:
This file verifies the server load for the public member invite page.

Deeper explanation:
The invite page now needs to tell the browser whether the invite creates a brand-new account or must
be accepted by an already signed-in account. These tests keep that server-derived state stable so the
page continues guiding users through the secure flow instead of drifting back to the unsafe one.

Summary of tests:
1. It verifies that an existing-account invite marks the current signed-in user as eligible to accept.
2. It verifies that invalid invite tokens return the public error state and keep viewer flags false.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks keep the page load focused on security-state branching rather than database details.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				getInvitePreviewByTokenHash: vi.fn()
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
	hashMemberInviteToken: mocks.hashMemberInviteToken
}));

import { load } from '../../src/routes/accept-member-invite/[token]/+page.server';

const createEvent = (input?: {
	invite?: unknown;
	viewerEmail?: string | null;
	viewerSignedIn?: boolean;
}) =>
	({
		params: {
			token: 'invite-token'
		},
		platform: {
			env: {
				DB: {}
			}
		},
		locals: {
			user:
				input?.viewerSignedIn === false
					? undefined
					: {
							id: 'user-1',
							email: input?.viewerEmail ?? 'existing@playims.test',
							clientId: 'client-9',
							role: 'participant',
							baseRole: 'participant',
							canViewAsRole: false,
							isViewingAsRole: false,
							viewAsRole: null
						},
			session:
				input?.viewerSignedIn === false
					? undefined
					: {
							id: 'session-1',
							userId: 'user-1',
							clientId: 'client-9',
							activeClientId: 'client-9',
							role: 'participant',
							baseRole: 'participant',
							canViewAsRole: false,
							isViewingAsRole: false,
							viewAsRole: null,
							authProvider: 'password',
							expiresAt: '2030-01-01T00:00:00.000Z'
						},
			requestLogMeta: undefined
		}
	}) as any;

describe('member invite page load', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hashMemberInviteToken.mockResolvedValue('invite-hash');
		mocks.dbOps.members.getInvitePreviewByTokenHash.mockResolvedValue(null);
	});

	it('marks a matching signed-in user as able to accept an existing-account invite', async () => {
		// the page should know this is a safe membership-link flow, not a password-creation flow.
		mocks.dbOps.members.getInvitePreviewByTokenHash.mockResolvedValue({
			clientName: 'PlayIMs',
			clientSlug: 'playims',
			email: 'existing@playims.test',
			firstName: 'Existing',
			lastName: 'Member',
			studentId: null,
			sex: null,
			role: 'participant',
			mode: 'invite',
			expiresAt: '2030-01-01T00:00:00.000Z',
			accountMode: 'existing-account'
		});

		const event = createEvent();
		const result = (await load(event)) as any;

		expect(result.invite?.accountMode).toBe('existing-account');
		expect(result.viewerSignedIn).toBe(true);
		expect(result.viewerMatchesInvite).toBe(true);
		expect(result.signInPath).toBe('/log-in?next=%2Faccept-member-invite%2Finvite-token');
		expect(event.locals.requestLogMeta).toEqual({
			table: 'member_invites',
			recordCount: 1
		});
	});

	it('returns the public invalid-invite state when the token cannot be used', async () => {
		// this keeps expired or revoked invite links from rendering any privileged acceptance state.
		const result = (await load(
			createEvent({
				viewerSignedIn: false
			})
		)) as any;

		expect(result).toEqual({
			token: 'invite-token',
			invite: null,
			error: 'Invite is expired, revoked, or invalid.',
			signInPath: '/log-in?next=%2Faccept-member-invite%2Finvite-token',
			viewerSignedIn: false,
			viewerMatchesInvite: false
		});
	});
});
