/*
Brief description:
This file verifies the current-schema user-client membership operations used by organization flows.

Deeper explanation:
Organization switching, creation, defaulting, and leaving all depend on `UserClientOperations`
writing against the modern `user_clients` schema with `last_used_at` support. These tests use a
real temporary SQLite database so the current membership queries and mutations are exercised
without the old migration-gap compatibility branches.

Summary of tests:
1. It verifies that active memberships load with client details and sort by most recent use first.
2. It verifies that recency updates persist to the membership row.
3. It verifies that membership creation can promote the new org to default.
4. It verifies that deactivating a membership clears it from active organization results.
*/

import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { afterEach, describe, expect, it } from 'vitest';
import { UserClientOperations } from '../../src/lib/database/operations/user-clients';
import { clients } from '../../src/lib/database/schema/clients';
import { userClients } from '../../src/lib/database/schema/user-clients';

type UserClientDatabase = {
	client: ReturnType<typeof createClient>;
	dbPath: string;
	operations: UserClientOperations;
};

const nowIso = '2030-01-01T00:00:00.000Z';

const createDatabase = async (): Promise<UserClientDatabase> => {
	const dbPath = join(tmpdir(), `playims-user-clients-${randomUUID()}.db`);
	const client = createClient({ url: `file:${dbPath}` });

	await client.execute(
		'CREATE TABLE clients (id text primary key not null, name text, slug text, created_at text, updated_at text, created_user text, updated_user text, status text, self_join_enabled integer, metadata text);'
	);
	await client.execute(
		'CREATE TABLE user_clients (id text primary key not null, user_id text not null, client_id text not null, role text not null, status text not null, student_id text, sex text, is_default integer not null, last_used_at text, created_at text not null, updated_at text not null, created_user text, updated_user text);'
	);

	const db = drizzle(client, {
		schema: { clients, userClients }
	});

	return {
		client,
		dbPath,
		operations: new UserClientOperations(db as any)
	};
};

const seedMemberships = async (client: ReturnType<typeof createClient>) => {
	await client.execute({
		sql: 'INSERT INTO clients (id, name, slug, created_at, updated_at, status, self_join_enabled) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?);',
		args: [
			'client-1',
			'Campus Rec',
			'campus-rec',
			nowIso,
			nowIso,
			'active',
			0,
			'client-2',
			'PlayIMs Club',
			'playims-club',
			nowIso,
			nowIso,
			'active',
			1,
			'client-3',
			'Late Night Rec',
			'late-night-rec',
			nowIso,
			nowIso,
			'active',
			0
		]
	});

	await client.execute({
		sql: 'INSERT INTO user_clients (id, user_id, client_id, role, status, student_id, sex, is_default, last_used_at, created_at, updated_at, created_user, updated_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			'membership-1',
			'user-1',
			'client-1',
			'admin',
			'active',
			null,
			null,
			1,
			'2030-01-01T00:00:00.000Z',
			nowIso,
			nowIso,
			null,
			null,
			'membership-2',
			'user-1',
			'client-2',
			'manager',
			'active',
			null,
			null,
			0,
			'2030-02-01T00:00:00.000Z',
			nowIso,
			nowIso,
			null,
			null
		]
	});
};

const cleanupDatabase = (database: UserClientDatabase) => {
	(database.client as { close?: () => void }).close?.();
	try {
		rmSync(database.dbPath, { force: true });
	} catch {
		// temporary database cleanup can race with Windows file handles briefly
	}
};

describe('user client operations', () => {
	const databases: UserClientDatabase[] = [];

	afterEach(() => {
		for (const database of databases.splice(0)) {
			cleanupDatabase(database);
		}
	});

	it('loads active organizations with client details sorted by most recent use first', async () => {
		// this keeps the org switcher and management surfaces aligned to the recency-enabled schema.
		const database = await createDatabase();
		databases.push(database);
		await seedMemberships(database.client);

		const memberships = await database.operations.listActiveForUserWithClientDetails('user-1');

		expect(memberships).toHaveLength(2);
		expect(memberships.map((entry) => entry.membership.clientId)).toEqual(['client-2', 'client-1']);
		expect(memberships[0]?.client?.name).toBe('PlayIMs Club');
	});

	it('persists recency updates on the active membership row', async () => {
		// this is the write path used after login and org switching.
		const database = await createDatabase();
		databases.push(database);
		await seedMemberships(database.client);

		const touchedMembership = await database.operations.touchLastUsedMembership(
			'user-1',
			'client-1',
			'2030-03-01T00:00:00.000Z',
			'user-1'
		);

		expect(touchedMembership?.clientId).toBe('client-1');
		expect(touchedMembership?.lastUsedAt).toBe('2030-03-01T00:00:00.000Z');
	});

	it('creates memberships and promotes the new organization to default when requested', async () => {
		// org creation depends on this path to attach the creator to the brand-new org immediately.
		const database = await createDatabase();
		databases.push(database);
		await seedMemberships(database.client);

		const membership = await database.operations.ensureMembership({
			userId: 'user-1',
			clientId: 'client-3',
			role: 'manager',
			status: 'active',
			isDefault: true,
			createdUser: 'user-1',
			updatedUser: 'user-1'
		});
		const memberships = await database.operations.listActiveForUser('user-1');

		expect(membership?.clientId).toBe('client-3');
		expect(membership?.isDefault).toBe(1);
		expect(
			memberships.find((entry) => entry.clientId === 'client-1')?.isDefault
		).toBe(0);
	});

	it('deactivates memberships so they no longer appear in active organization results', async () => {
		// leave-organization flows rely on this to immediately remove the org from active lists.
		const database = await createDatabase();
		databases.push(database);
		await seedMemberships(database.client);

		const deactivated = await database.operations.deactivateMembership('user-1', 'client-2', 'user-1');
		const memberships = await database.operations.listActiveForUser('user-1');

		expect(deactivated?.clientId).toBe('client-2');
		expect(deactivated?.status).toBe('inactive');
		expect(memberships.map((entry) => entry.clientId)).toEqual(['client-1']);
	});
});
