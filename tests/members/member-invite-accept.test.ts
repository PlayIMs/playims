/*
Brief description:
This file verifies the API route that accepts member invitation tokens.

Deeper explanation:
Accepting an invite coordinates password hashing, membership activation, login bookkeeping, and session
creation. That flow touches several auth helpers, so these tests replace those helpers with mocks and
focus on the route contract itself. This keeps the success and failure paths readable without losing
coverage on the important decisions.

Summary of tests:
1. It verifies that invalid or expired invite tokens return a not-found response.
2. It verifies that existing-account invites require the invited user to be signed in first.
3. It verifies that a signed-in invited user can accept an existing-account invite without resetting a password.
4. It verifies that a valid new-account invite creates login state and starts a session.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks let the route import fake auth and database helpers from the start.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				getInvitePreviewByTokenHash: vi.fn(),
				acceptInvite: vi.fn()
			},
			users: {
				markLoginSuccess: vi.fn()
			}
		},
		getCentralDbOps: vi.fn(),
		createSessionForUser: vi.fn(),
		hashPassword: vi.fn(),
		normalizeIterations: vi.fn(),
		requireSessionSecret: vi.fn(),
		resolvePasswordPepper: vi.fn()
	};
});

// the route keeps its real request parsing and branching, but all side effects are test-controlled.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/auth/session', () => ({
	createSessionForUser: mocks.createSessionForUser
}));

vi.mock('$lib/server/auth/password', () => ({
	hashPassword: mocks.hashPassword,
	normalizeIterations: mocks.normalizeIterations
}));

vi.mock('$lib/server/auth/service', () => ({
	requireSessionSecret: mocks.requireSessionSecret,
	resolvePasswordPepper: mocks.resolvePasswordPepper
}));

import { POST } from '../../src/routes/api/member-invites/accept/+server';

// this helper builds a realistic route event so each test only changes the posted invite payload.
const buildEvent = (body: Record<string, unknown>) =>
	({
		platform: {
			env: {
				DB: {},
				AUTH_PASSWORD_PBKDF2_ITERATIONS: '210000'
			}
		},
		locals: {},
		request: new Request('https://playims.test/api/member-invites/accept', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as any;

describe('member invite acceptance endpoint', () => {
	beforeEach(() => {
		// these defaults represent the simplest successful invite-acceptance flow.
		vi.clearAllMocks();
		mocks.hashPassword.mockResolvedValue('password-hash');
		mocks.normalizeIterations.mockImplementation((value: string | number | undefined) =>
			Number(value ?? 210000)
		);
		mocks.requireSessionSecret.mockReturnValue('session-secret');
		mocks.resolvePasswordPepper.mockReturnValue('pepper-secret');
		mocks.dbOps.members.getInvitePreviewByTokenHash.mockResolvedValue(null);
		mocks.dbOps.members.acceptInvite.mockResolvedValue({ status: 'invalid-invite' });
		mocks.dbOps.users.markLoginSuccess.mockResolvedValue(null);
	});

	it('returns not found for invalid or expired invite tokens', async () => {
		// a null accept invite result is the route's signal that the token cannot be used.
		const response = await POST(
			buildEvent({
				token: 'bad-token',
				password: 'StrongPass123',
				confirmPassword: 'StrongPass123',
				firstName: 'Jamie',
				lastName: 'Member'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.error).toBe('Invite is expired, revoked, or invalid.');
		expect(mocks.hashPassword).not.toHaveBeenCalled();
		expect(mocks.createSessionForUser).not.toHaveBeenCalled();
	});

	it('requires sign-in before accepting an invite for an existing account', async () => {
		// the route should block password creation here because the invited email already owns an account.
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
		mocks.dbOps.members.acceptInvite.mockResolvedValue({
			status: 'authentication-required',
			email: 'existing@playims.test'
		});

		const response = await POST(
			buildEvent({
				token: 'existing-token',
				firstName: 'Evil',
				lastName: 'Overwrite',
				password: 'StrongPass123',
				confirmPassword: 'StrongPass123'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(409);
		expect(payload.error).toBe(
			'This invite is for an email that already has a PlayIMs account. Sign in with that account to accept the invite.'
		);
		expect(mocks.hashPassword).not.toHaveBeenCalled();
		expect(mocks.dbOps.members.acceptInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				tokenHash: expect.any(String),
				actorUserId: null
			})
		);
		expect(mocks.createSessionForUser).not.toHaveBeenCalled();
	});

	it('accepts an existing-account invite for the matching signed-in user without hashing a password', async () => {
		// the invite should activate membership only and leave the signed-in account credentials alone.
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
		mocks.dbOps.members.acceptInvite.mockResolvedValue({
			status: 'accepted',
			user: {
				id: 'user-1',
				email: 'existing@playims.test',
				firstName: 'Existing',
				lastName: 'Member',
				passwordHash: 'unchanged-hash',
				status: 'active',
				cellPhone: null,
				createdAt: '2029-12-20T00:00:00.000Z',
				updatedAt: '2029-12-20T00:00:00.000Z',
				createdUser: null,
				updatedUser: null,
				emailVerifiedAt: null,
				ssoUserId: null,
				avatarUrl: null,
				firstLoginAt: null,
				lastLoginAt: null,
				timezone: null,
				lastActiveAt: null,
				sessionCount: 1,
				preferences: null,
				notes: null
			},
			clientId: 'client-1',
			role: 'participant',
			createdUser: false,
			reactivatedMembership: true
		});
		const event = buildEvent({
			token: 'existing-token'
		});
		event.locals = {
			user: {
				id: 'user-1',
				email: 'existing@playims.test',
				clientId: 'client-9',
				role: 'participant',
				baseRole: 'participant',
				canViewAsRole: false,
				isViewingAsRole: false,
				viewAsRole: null
			},
			session: {
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
			}
		};

		const response = await POST(event);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.dbOps.members.acceptInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				tokenHash: expect.any(String),
				actorUserId: 'user-1'
			})
		);
		expect(mocks.hashPassword).not.toHaveBeenCalled();
		expect(mocks.dbOps.users.markLoginSuccess).not.toHaveBeenCalled();
		expect(mocks.createSessionForUser).not.toHaveBeenCalled();
	});

	it('creates a session after accepting a valid new-account invite', async () => {
		// this fixture mirrors the route's returned user data closely so the session handoff stays realistic.
		mocks.dbOps.members.getInvitePreviewByTokenHash.mockResolvedValue({
			clientName: 'PlayIMs',
			clientSlug: 'playims',
			email: 'new@playims.test',
			firstName: 'Jamie',
			lastName: 'Member',
			studentId: null,
			sex: null,
			role: 'participant',
			mode: 'invite',
			expiresAt: '2030-01-01T00:00:00.000Z',
			accountMode: 'new-account'
		});
		mocks.dbOps.members.acceptInvite.mockResolvedValue({
			status: 'accepted',
			user: {
				id: 'user-1',
				email: 'new@playims.test',
				firstName: 'Jamie',
				lastName: 'Member',
				passwordHash: 'password-hash',
				status: 'active',
				cellPhone: null,
				createdAt: '2029-12-20T00:00:00.000Z',
				updatedAt: '2029-12-20T00:00:00.000Z',
				createdUser: null,
				updatedUser: null,
				emailVerifiedAt: null,
				ssoUserId: null,
				avatarUrl: null,
				firstLoginAt: null,
				lastLoginAt: null,
				timezone: null,
				lastActiveAt: null,
				sessionCount: 0,
				preferences: null,
				notes: null
			},
			clientId: 'client-1',
			role: 'participant',
			createdUser: true,
			reactivatedMembership: false
		});
		mocks.dbOps.users.markLoginSuccess.mockResolvedValue({
			id: 'user-1',
			email: 'new@playims.test'
		});
		mocks.createSessionForUser.mockResolvedValue({
			session: { id: 'session-1', activeClientId: 'client-1', role: 'participant' },
			user: { id: 'user-1', clientId: 'client-1', role: 'participant' }
		});

		const response = await POST(
			buildEvent({
				token: 'good-token',
				password: 'StrongPass123',
				confirmPassword: 'StrongPass123',
				firstName: 'Jamie',
				lastName: 'Member'
			})
		);
		const payload = await response.json();

		// these assertions prove the route wires password hashing, membership acceptance, and session creation together.
		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(mocks.dbOps.members.acceptInvite).toHaveBeenCalledWith(
			expect.objectContaining({
				passwordHash: 'password-hash',
				firstName: 'Jamie',
				lastName: 'Member'
			})
		);
		expect(mocks.createSessionForUser).toHaveBeenCalledWith(
			expect.any(Object),
			mocks.dbOps,
			expect.objectContaining({ id: 'user-1' }),
			'session-secret',
			{
				activeClientId: 'client-1',
				activeRole: 'participant'
			}
		);
	});
});
