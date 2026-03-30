/*
Brief description:
This file verifies the member search database logic for phone-number matching.

Deeper explanation:
Phone-number searching is implemented inside the SQL conditions that back the members table. That
means a plain mocked route test would not prove the real behavior. These tests use a temporary
SQLite database so the search query itself has to handle punctuation stripping and the optional
+1 country code correctly.

Summary of tests:
1. It verifies that formatted phone-number searches match stored member phone numbers.
2. It verifies that the same member can be found whether the search includes the leading 1 or not.
3. It verifies that the last-active-season filter keeps only members whose last login falls inside that season.
*/

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MemberOperations } from '../../src/lib/database/operations/members';

const createdDbPaths: string[] = [];

afterEach(() => {
	// temp sqlite files are enough for these focused tests, and cleanup keeps repeated runs tidy.
	for (const dbPath of createdDbPaths.splice(0)) {
		try {
			rmSync(dbPath, { force: true });
		} catch {
			// windows can briefly hold the file lock, which is harmless for test cleanup.
		}
	}
});

async function createMemberOperationsFixture() {
	// using a real sqlite file makes the search conditions prove themselves instead of relying on mocks.
	const dbPath = join(tmpdir(), `playims-member-search-${randomUUID()}.db`);
	createdDbPaths.push(dbPath);
	const client = createClient({ url: `file:${dbPath}` });
	const db = drizzle(client);

	await client.execute('CREATE TABLE clients (id text primary key not null, name text);');
	await client.execute(`
		CREATE TABLE users (
			id text primary key not null,
			email text,
			first_name text,
			last_name text,
			cell_phone text,
			last_login_at text,
			status text
		);
	`);
	await client.execute(`
		CREATE TABLE seasons (
			id text primary key not null,
			client_id text,
			name text,
			slug text,
			start_date text,
			end_date text,
			is_current integer,
			is_active integer,
			created_at text,
			updated_at text,
			created_user text,
			updated_user text
		);
	`);
	await client.execute(`
		CREATE TABLE user_clients (
			id text primary key not null,
			user_id text not null,
			client_id text not null,
			role text not null,
			status text not null,
			student_id text,
			sex text,
			is_default integer not null,
			created_at text not null,
			updated_at text not null
		);
	`);

	// one client and two users are enough to prove match versus non-match behavior.
	await client.execute({
		sql: 'INSERT INTO clients (id, name) VALUES (?, ?);',
		args: ['client-1', 'Test Org']
	});
	await client.execute({
		sql: 'INSERT INTO seasons (id, client_id, name, slug, start_date, end_date, is_current, is_active, created_at, updated_at, created_user, updated_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			'season-spring',
			'client-1',
			'Spring 2029',
			'spring-2029',
			'2029-01-01',
			'2029-03-31',
			1,
			1,
			'2029-01-01T00:00:00.000Z',
			'2029-01-01T00:00:00.000Z',
			null,
			null
		]
	});
	await client.execute({
		sql: 'INSERT INTO seasons (id, client_id, name, slug, start_date, end_date, is_current, is_active, created_at, updated_at, created_user, updated_user) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			'season-fall',
			'client-1',
			'Fall 2029',
			'fall-2029',
			'2029-08-01',
			'2029-12-01',
			0,
			1,
			'2029-08-01T00:00:00.000Z',
			'2029-08-01T00:00:00.000Z',
			null,
			null
		]
	});
	await client.execute({
		sql: 'INSERT INTO users (id, email, first_name, last_name, cell_phone, last_login_at, status) VALUES (?, ?, ?, ?, ?, ?, ?);',
		args: [
			'user-1',
			'jamie@playims.test',
			'Jamie',
			'Member',
			'+1 (661) 803-3757',
			'2029-03-21T14:30:00.000Z',
			'active'
		]
	});
	await client.execute({
		sql: 'INSERT INTO users (id, email, first_name, last_name, cell_phone, last_login_at, status) VALUES (?, ?, ?, ?, ?, ?, ?);',
		args: [
			'user-2',
			'other@playims.test',
			'Other',
			'Person',
			'+1 (555) 111-2222',
			'2029-12-20T14:30:00.000Z',
			'active'
		]
	});
	await client.execute({
		sql: 'INSERT INTO user_clients (id, user_id, client_id, role, status, student_id, sex, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			'membership-1',
			'user-1',
			'client-1',
			'participant',
			'active',
			'10001',
			'F',
			0,
			'2029-12-20T00:00:00.000Z',
			'2029-12-20T00:00:00.000Z'
		]
	});
	await client.execute({
		sql: 'INSERT INTO user_clients (id, user_id, client_id, role, status, student_id, sex, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
		args: [
			'membership-2',
			'user-2',
			'client-1',
			'participant',
			'active',
			'10002',
			'M',
			0,
			'2029-12-20T00:00:00.000Z',
			'2029-12-20T00:00:00.000Z'
		]
	});

	return {
		client,
		operations: new MemberOperations(db as never)
	};
}

describe('member search phone matching', () => {
	it('matches phone queries even when the search includes punctuation', async () => {
		// users often paste formatted phone numbers, so search should ignore the visual separators.
		const { client, operations } = await createMemberOperationsFixture();

		try {
			const result = await operations.searchByClient({
				clientId: 'client-1',
				query: '(661) 803-3757'
			});

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]?.membershipId).toBe('membership-1');
		} finally {
			client.close();
		}
	});

	it('matches the same phone number with or without the leading one country code', async () => {
		// search should find the same member whether the user types eleven digits or the local ten-digit form.
		const { client, operations } = await createMemberOperationsFixture();

		try {
			const withCountryCode = await operations.searchByClient({
				clientId: 'client-1',
				query: '16618033757'
			});
			const withoutCountryCode = await operations.searchByClient({
				clientId: 'client-1',
				query: '6618033757'
			});

			expect(withCountryCode.rows).toHaveLength(1);
			expect(withCountryCode.rows[0]?.membershipId).toBe('membership-1');
			expect(withoutCountryCode.rows).toHaveLength(1);
			expect(withoutCountryCode.rows[0]?.membershipId).toBe('membership-1');
		} finally {
			client.close();
		}
	});

	it('filters members by the selected last active season based on last-login date', async () => {
		// season filtering should keep only members whose last login happened within that season window.
		const { client, operations } = await createMemberOperationsFixture();

		try {
			const inSpringSeason = await operations.searchByClient({
				clientId: 'client-1',
				query: 'member',
				lastActiveSeasonId: 'season-spring'
			});
			const inFallSeason = await operations.searchByClient({
				clientId: 'client-1',
				query: 'member',
				lastActiveSeasonId: 'season-fall'
			});

			expect(inSpringSeason.rows).toHaveLength(1);
			expect(inSpringSeason.rows[0]?.membershipId).toBe('membership-1');
			expect(inFallSeason.rows).toEqual([]);
		} finally {
			client.close();
		}
	});
});
