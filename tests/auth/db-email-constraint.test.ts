import { createClient } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('normalized email uniqueness', () => {
	it('rejects duplicate email values differing only by case/whitespace', async () => {
		const dbPath = join(tmpdir(), `playims-auth-${randomUUID()}.db`);
		const client = createClient({ url: `file:${dbPath}` });

		try {
			await client.execute(
				'CREATE TABLE users (id text primary key not null, email text, client_id text, role text, status text);'
			);
			await client.execute(
				"CREATE UNIQUE INDEX users_email_normalized_unique ON users (lower(trim(email))) WHERE email IS NOT NULL AND trim(email) <> '';"
			);

			await client.execute({
				sql: 'INSERT INTO users (id, email, client_id, role, status) VALUES (?, ?, ?, ?, ?);',
				args: [randomUUID(), 'Test@PlayIMS.com', 'client-a', 'manager', 'active']
			});

			await expect(
				client.execute({
					sql: 'INSERT INTO users (id, email, client_id, role, status) VALUES (?, ?, ?, ?, ?);',
					args: [randomUUID(), '  test@playims.com  ', 'client-b', 'manager', 'active']
				})
			).rejects.toThrow();
		} finally {
			(client as { close?: () => void }).close?.();
			try {
				rmSync(dbPath, { force: true });
			} catch {
				// Windows can keep a short-lived lock; this temp file is safe to leave behind in CI/dev.
			}
		}
	});
});
