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
2. It verifies that a valid invite creates login state and starts a session.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks let the route import fake auth and database helpers from the start.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
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
				AUTH_PASSWORD_ITERATIONS: '210000'
			}
		},
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
		mocks.dbOps.members.acceptInvite.mockResolvedValue(null);
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
		expect(mocks.createSessionForUser).not.toHaveBeenCalled();
	});

	it('creates a session after accepting a valid invite', async () => {
		// this fixture mirrors the route's returned user data closely so the session handoff stays realistic.
		mocks.dbOps.members.acceptInvite.mockResolvedValue({
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
