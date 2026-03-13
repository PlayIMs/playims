/*
Brief description:
This file verifies that member invite acceptance keeps existing accounts safe.

Deeper explanation:
The high-risk bug lived inside the member database operation itself, not only in the API route. These
tests use a temporary SQLite database and the real `MemberOperations` class so the core acceptance
rules are proven against real data mutations. That prevents future callers from accidentally turning
an invite into a password reset again.

Summary of tests:
1. It verifies that existing-account invites stay pending until the invited user is authenticated.
2. It verifies that an authenticated existing user can accept an invite without changing their password or profile name.
*/

import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { afterEach, describe, expect, it } from 'vitest';
import { MemberOperations } from '../../src/lib/database/operations/members';
import { clients } from '../../src/lib/database/schema/clients';
import { memberInvites } from '../../src/lib/database/schema/member-invites';
import { userClients } from '../../src/lib/database/schema/user-clients';
import { users } from '../../src/lib/database/schema/users';

type TestDatabase = {
	client: ReturnType<typeof createClient>;
	dbPath: string;
	members: MemberOperations;
};

const activeClientId = 'client-1';
const existingUserId = 'user-1';
const existingMembershipId = 'membership-1';
const nowIso = '2030-01-01T00:00:00.000Z';
const futureIso = '2030-06-01T00:00:00.000Z';

const createTempDatabase = async (): Promise<TestDatabase> => {
	const dbPath = join(tmpdir(), `playims-members-${randomUUID()}.db`);
	const client = createClient({ url: `file:${dbPath}` });

	await client.execute(
		'CREATE TABLE clients (id text primary key not null, name text, slug text, created_at text, updated_at text, created_user text, updated_user text, status text, self_join_enabled integer, metadata text);'
	);
	await client.execute(
		'CREATE TABLE users (id text primary key not null, email text, email_verified_at text, password_hash text, sso_user_id text, first_name text, last_name text, cell_phone text, avatar_url text, created_at text, updated_at text, created_user text, updated_user text, first_login_at text, last_login_at text, status text, timezone text, last_active_at text, session_count integer, preferences text, notes text);'
	);
	await client.execute(
		'CREATE TABLE user_clients (id text primary key not null, user_id text not null, client_id text not null, role text not null, status text not null, student_id text, sex text, is_default integer not null, created_at text not null, updated_at text not null, created_user text, updated_user text);'
	);
	await client.execute(
		'CREATE TABLE member_invites (id text primary key not null, client_id text not null, email text not null, first_name text, last_name text, student_id text, sex text, role text not null, mode text not null, token_hash text not null, status text not null, expires_at text not null, accepted_at text, accepted_user_id text, created_at text not null, updated_at text not null, created_user text, updated_user text);'
	);

	const db = drizzle(client, {
		schema: { clients, users, userClients, memberInvites }
	});

	return {
		client,
		dbPath,
		members: new MemberOperations(db as any)
	};
};

const seedExistingAccountInvite = async (client: ReturnType<typeof createClient>) => {
	// this fixture models a pre-existing user who received a fresh org invite with new membership details.
	await client.execute({
		sql: 'INSERT INTO clients (id, name, slug, created_at, updated_at, status, self_join_enabled) VALUES (?, ?, ?, ?, ?, ?, ?);',
		args: [activeClientId, 'PlayIMs', 'playims', nowIso, nowIso, 'active', 0]
	});
	await client.execute({
		sql: 'INSERT INTO users (id, email, password_hash, first_name, last_name, status, created_at, updated_at, session_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			existingUserId,
			'existing@playims.test',
			'original-password-hash',
			'Existing',
			'Member',
			'active',
			nowIso,
			nowIso,
			1
		]
	});
	await client.execute({
		sql: 'INSERT INTO user_clients (id, user_id, client_id, role, status, student_id, sex, is_default, created_at, updated_at, created_user, updated_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			existingMembershipId,
			existingUserId,
			activeClientId,
			'participant',
			'inactive',
			'ST-001',
			'F',
			0,
			nowIso,
			nowIso,
			null,
			null
		]
	});
	await client.execute({
		sql: 'INSERT INTO member_invites (id, client_id, email, first_name, last_name, student_id, sex, role, mode, token_hash, status, expires_at, accepted_at, accepted_user_id, created_at, updated_at, created_user, updated_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			'invite-1',
			activeClientId,
			'existing@playims.test',
			'Injected',
			'Invite',
			'ST-999',
			'M',
			'manager',
			'invite',
			'invite-hash',
			'pending',
			futureIso,
			null,
			null,
			nowIso,
			nowIso,
			null,
			null
		]
	});
};

const cleanupDatabase = (db: TestDatabase) => {
	(db.client as { close?: () => void }).close?.();
	try {
		rmSync(db.dbPath, { force: true });
	} catch {
		// windows can keep a short-lived file lock, which is harmless for this temp database.
	}
};

describe('member invite acceptance operation', () => {
	const databases: TestDatabase[] = [];

	afterEach(() => {
		for (const db of databases.splice(0)) {
			cleanupDatabase(db);
		}
	});

	it('keeps existing-account invites pending until the invited user is authenticated', async () => {
		// this proves the core operation itself no longer acts like a password reset for an existing account.
		const database = await createTempDatabase();
		databases.push(database);
		await seedExistingAccountInvite(database.client);

		const result = await database.members.acceptInvite({
			tokenHash: 'invite-hash',
			passwordHash: 'replacement-password-hash',
			firstName: 'Injected',
			lastName: 'Invite',
			actorUserId: null,
			createdUser: null
		});

		expect(result).toEqual({
			status: 'authentication-required',
			email: 'existing@playims.test'
		});

		// the invite should remain usable and the existing account record should remain untouched.
		const userResult = await database.client.execute({
			sql: 'SELECT password_hash, first_name, last_name FROM users WHERE id = ?;',
			args: [existingUserId]
		});
		expect(userResult.rows[0]).toMatchObject({
			password_hash: 'original-password-hash',
			first_name: 'Existing',
			last_name: 'Member'
		});

		const inviteResult = await database.client.execute({
			sql: 'SELECT status, accepted_user_id FROM member_invites WHERE id = ?;',
			args: ['invite-1']
		});
		expect(inviteResult.rows[0]).toMatchObject({
			status: 'pending',
			accepted_user_id: null
		});
	});

	it('reactivates existing membership without changing the existing user password or name', async () => {
		// this acceptance path should only attach the org membership and mark the invite accepted.
		const database = await createTempDatabase();
		databases.push(database);
		await seedExistingAccountInvite(database.client);

		const result = await database.members.acceptInvite({
			tokenHash: 'invite-hash',
			passwordHash: 'replacement-password-hash',
			firstName: 'Injected',
			lastName: 'Invite',
			actorUserId: existingUserId,
			createdUser: null
		});

		expect(result).toMatchObject({
			status: 'accepted',
			createdUser: false,
			reactivatedMembership: true,
			clientId: activeClientId,
			role: 'manager'
		});

		// the security-critical check is that the original user secret and profile stay intact.
		const userResult = await database.client.execute({
			sql: 'SELECT password_hash, first_name, last_name FROM users WHERE id = ?;',
			args: [existingUserId]
		});
		expect(userResult.rows[0]).toMatchObject({
			password_hash: 'original-password-hash',
			first_name: 'Existing',
			last_name: 'Member'
		});

		const membershipResult = await database.client.execute({
			sql: 'SELECT role, status, student_id, sex FROM user_clients WHERE id = ?;',
			args: [existingMembershipId]
		});
		expect(membershipResult.rows[0]).toMatchObject({
			role: 'manager',
			status: 'active',
			student_id: 'ST-999',
			sex: 'M'
		});

		const inviteResult = await database.client.execute({
			sql: 'SELECT status, accepted_user_id FROM member_invites WHERE id = ?;',
			args: ['invite-1']
		});
		expect(inviteResult.rows[0]).toMatchObject({
			status: 'accepted',
			accepted_user_id: existingUserId
		});
	});
});
