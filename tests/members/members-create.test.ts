/*
Brief description:
This file verifies the API route that adds members into an organization.

Deeper explanation:
Member creation can now branch into immediate membership linking or direct account creation depending
on whether the email already belongs to an existing user. The route also enforces strong
authorization and duplicate-student safeguards. These tests mock the database and password helpers so
each branch can be explained clearly.

Summary of tests:
1. It verifies that participants cannot add members.
2. It verifies that managers can add members through the same endpoint.
3. It verifies that duplicate student IDs are rejected within the same organization.
4. It verifies that an existing user can be linked immediately.
5. It verifies that a brand-new account is created with a one-time temporary password.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

// these hoisted mocks keep the route connected to fake member, user, and password helpers during import.
const mocks = vi.hoisted(() => {
	return {
		dbOps: {
			members: {
				findActiveByStudentId: vi.fn(),
				addOrReactivateMember: vi.fn(),
				getByMembershipId: vi.fn()
			},
			users: {
				createAuthUser: vi.fn()
			},
			userClients: {
				ensureMembership: vi.fn()
			}
		},
		getCentralDbOps: vi.fn(),
		hashPassword: vi.fn()
	};
});

// the route logic stays real while database lookups are driven by the test fixtures below.
vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockImplementation(() => mocks.dbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps
	};
});

vi.mock('$lib/server/auth/password', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/auth/password')>(
		'$lib/server/auth/password'
	);
	return {
		...actual,
		hashPassword: mocks.hashPassword
	};
});

import { POST } from '../../src/routes/api/members/+server';

// this helper builds an authenticated request and lets each test focus on one member-creation payload.
const buildEvent = (role: string, body: Record<string, unknown>) =>
	({
		platform: {
			env: {
				DB: {},
				AUTH_PASSWORD_PEPPER: 'pepper-secret',
				AUTH_PASSWORD_PBKDF2_ITERATIONS: '210000'
			}
		},
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
		// these defaults represent the standard happy path with no duplicates or existing user collisions.
		vi.clearAllMocks();
		mocks.hashPassword.mockResolvedValue('temporary-password-hash');
		mocks.dbOps.members.findActiveByStudentId.mockResolvedValue(null);
		mocks.dbOps.members.addOrReactivateMember.mockResolvedValue({ status: 'user-not-found' });
		mocks.dbOps.members.getByMembershipId.mockResolvedValue({
			membershipId: 'membership-1',
			userId: 'user-2',
			clientId: 'client-1',
			studentId: '12345',
			firstName: 'Jamie',
			lastName: 'Member',
			fullName: 'Jamie Member',
			email: 'new@playims.test',
			sex: 'F',
			role: 'participant',
			status: 'active',
			createdAt: '2029-12-20T00:00:00.000Z',
			updatedAt: '2029-12-20T00:00:00.000Z',
			avatarUrl: null,
			cellPhone: null,
			lastLoginAt: null,
			lastActiveAt: null
		});
		mocks.dbOps.users.createAuthUser.mockResolvedValue({
			id: 'user-2',
			email: 'new@playims.test',
			passwordHash: 'temporary-password-hash',
			firstName: 'Jamie',
			lastName: 'Member',
			status: 'active'
		});
		mocks.dbOps.userClients.ensureMembership.mockResolvedValue({
			id: 'membership-1',
			userId: 'user-2',
			clientId: 'client-1',
			role: 'participant',
			status: 'active'
		});
	});

	it('rejects add-member attempts from participants', async () => {
		// participant users should be denied before the route attempts any member write.
		const response = await POST(
			buildEvent('participant', {
				email: 'new@playims.test',
				role: 'participant',
				firstName: 'Jamie',
				lastName: 'Member',
				studentId: '12345',
				sex: 'F'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(403);
		expect(payload.error).toBe('You do not have permission to add members.');
		expect(mocks.dbOps.members.addOrReactivateMember).not.toHaveBeenCalled();
	});

	it('lets managers add members through the direct-create endpoint', async () => {
		// manager access matters here because the page button and the api should agree on who can add members.
		const response = await POST(
			buildEvent('manager', {
				email: 'existing@playims.test',
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
		expect(mocks.dbOps.members.addOrReactivateMember).toHaveBeenCalled();
	});

	it('rejects duplicate student IDs inside the same organization', async () => {
		// this protects a client-level uniqueness rule that would otherwise be easy to bypass through the api.
		mocks.dbOps.members.findActiveByStudentId.mockResolvedValue('membership-2');

		const response = await POST(
			buildEvent('admin', {
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

	it('links an existing user immediately when the email already has an account', async () => {
		// this is the fast path where member creation succeeds without generating any temporary credentials.
		mocks.dbOps.members.addOrReactivateMember.mockResolvedValue({
			status: 'added',
			member: {
				membershipId: 'membership-7',
				userId: 'user-7',
				clientId: 'client-1',
				studentId: '12345',
				firstName: 'Jamie',
				lastName: 'Member',
				fullName: 'Jamie Member',
				email: 'existing@playims.test',
				sex: 'F',
				role: 'participant',
				status: 'active',
				createdAt: '2029-12-20T00:00:00.000Z',
				updatedAt: '2029-12-20T00:00:00.000Z',
				avatarUrl: null,
				cellPhone: null,
				lastLoginAt: null,
				lastActiveAt: null
			}
		});

		const response = await POST(
			buildEvent('admin', {
				email: 'existing@playims.test',
				role: 'participant',
				firstName: 'Jamie',
				lastName: 'Member',
				studentId: '12345',
				sex: 'F'
			})
		);
		const payload = await response.json();

		// existing-user linking should not generate a temporary password because the account already exists.
		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.data.addedExistingUser).toBe(true);
		expect(payload.data.createdNewUser).toBe(false);
		expect(payload.data.temporaryPassword).toBeUndefined();
		expect(mocks.dbOps.users.createAuthUser).not.toHaveBeenCalled();
	});

	it('creates a brand-new account with a one-time temporary password when no user exists', async () => {
		// this is the new direct-create branch that replaces the invite workflow for unknown emails.
		const response = await POST(
			buildEvent('admin', {
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
		expect(payload.data.createdNewUser).toBe(true);
		expect(typeof payload.data.temporaryPassword).toBe('string');
		expect(payload.data.temporaryPassword.length).toBeGreaterThanOrEqual(12);
		expect(mocks.hashPassword).toHaveBeenCalledWith(
			expect.objectContaining({
				password: payload.data.temporaryPassword
			})
		);
		expect(mocks.dbOps.users.createAuthUser).toHaveBeenCalledWith(
			expect.objectContaining({
				email: 'new@playims.test',
				passwordHash: 'temporary-password-hash',
				firstName: 'Jamie',
				lastName: 'Member'
			})
		);
		expect(mocks.dbOps.userClients.ensureMembership).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-2',
				clientId: 'client-1',
				role: 'participant',
				studentId: '12345',
				sex: 'F',
				createdUser: 'user-1'
			})
		);
	});
});
