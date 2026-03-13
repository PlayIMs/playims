/*
Brief description:
This file verifies that normalized email uniqueness is enforced at the database level.

Deeper explanation:
Authentication logic depends on email addresses behaving as one canonical identity even when users
type different casing or extra whitespace. This test uses a real temporary SQLite database because
the normalization rule is implemented as an index expression. That makes the database itself prove
the constraint instead of relying on mocked behavior.

Summary of tests:
1. It verifies that duplicate email values fail when they only differ by case or surrounding whitespace.
*/

import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('normalized email uniqueness', () => {
	it('rejects duplicate email values differing only by case/whitespace', async () => {
		// a real temp database is used here because the behavior lives inside a sqlite index rule,
		// not in a plain typescript helper that can be mocked safely.
		const dbPath = join(tmpdir(), `playims-auth-${randomUUID()}.db`);
		const client = createClient({ url: `file:${dbPath}` });

		try {
			// this schema mirrors the minimum database shape needed to prove the normalized index works.
			await client.execute(
				'CREATE TABLE users (id text primary key not null, email text, status text);'
			);
			await client.execute(
				"CREATE UNIQUE INDEX users_email_normalized_unique ON users (lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';"
			);

			// the first insert seeds the normalized email value that the second insert should collide with.
			await client.execute({
				sql: 'INSERT INTO users (id, email, status) VALUES (?, ?, ?);',
				args: [randomUUID(), 'Test@PlayIMS.com', 'active']
			});

			// the second insert differs only by case and surrounding spaces, so the normalized index
			// should still treat it as a duplicate and reject it.
			await expect(
				client.execute({
					sql: 'INSERT INTO users (id, email, status) VALUES (?, ?, ?);',
					args: [randomUUID(), '  test@playims.com  ', 'active']
				})
			).rejects.toThrow();
		} finally {
			(client as { close?: () => void }).close?.();
			try {
				rmSync(dbPath, { force: true });
			} catch {
				// windows can keep a short-lived lock, and leaving this temp file behind is harmless.
			}
		}
	});
});
