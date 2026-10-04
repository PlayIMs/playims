/*
Brief description:
This file verifies login action error handling and private server diagnostics.

Deeper explanation:
Cloudflare can label an invocation as successful even when a SvelteKit action returns a handled
failure. These tests protect the public error response and ensure backend failures can be diagnosed
without recording credentials or exposing internal errors to the browser.

Summary of tests:
1. It verifies that credential rejection remains generic and quiet.
2. It verifies that missing configuration and unexpected failures remain generic server errors.
3. It verifies that backend diagnostics classify configuration, database, and hashing failures safely.
4. It verifies that localhost login failures and missing database bindings are also logged.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ login: vi.fn(), localLogin: vi.fn(), db: vi.fn() }));

vi.mock('$lib/server/database/context', () => ({ getCentralDbOps: mocks.db }));
vi.mock('$lib/server/auth/service', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/auth/service')>(
		'$lib/server/auth/service'
	);
	return {
		...actual,
		loginWithPassword: mocks.login,
		loginWithLocalDevCredentials: mocks.localLogin
	};
});

import { AuthServiceError } from '../../src/lib/server/auth/service';
import { actions } from '../../src/routes/log-in/+page.server';

const submit = (
	email = 'diagnostic@example.invalid',
	password = 'private-test-password',
	withDb = true
) => {
	// use the real form parser so the test follows the production action's entry point.
	return actions.default!({
		request: new Request('https://playims.test/log-in', {
			method: 'POST',
			body: new URLSearchParams({ email, password, next: '/dashboard' })
		}),
		url: new URL('https://playims.test/log-in'),
		platform: { env: withDb ? { DB: {} } : {} },
		locals: { requestId: 'login-request-123' }
	} as any);
};

describe('login action failures', () => {
	beforeEach(() => {
		// reset dependencies to prevent a failure in one test from changing another scenario.
		vi.resetAllMocks();
		mocks.db.mockReturnValue({});
	});
	afterEach(() => vi.restoreAllMocks());

	it('keeps credential rejection generic', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.login.mockRejectedValue(new AuthServiceError(401, 'AUTH_INVALID_CREDENTIALS', 'Denied'));
		expect(await submit()).toMatchObject({
			status: 401,
			data: { errorCode: 'AUTH_LOGIN_FAILED', errorStatus: 401 }
		});
		expect(log).not.toHaveBeenCalled();
	});

	it.each([
		[new AuthServiceError(500, 'AUTH_CONFIG_MISSING', 'Missing secret'), 'AUTH_CONFIG_MISSING'],
		[
			new Error('Pbkdf2 failed: iteration counts above 100000 are not supported.'),
			'PASSWORD_HASH_RUNTIME_LIMIT'
		],
		[
			new Error('Query failed', { cause: new Error('D1_ERROR: no such column: password_hash') }),
			'DATABASE_SCHEMA_MISMATCH'
		],
		[new Error('D1_ERROR: backend unavailable'), 'DATABASE_FAILURE'],
		[new Error('private-test-password diagnostic@example.invalid secret-value'), 'UNEXPECTED_ERROR']
	])('logs a safe backend failure category', async (error, reason) => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.login.mockRejectedValue(error);
		await submit();
		expect(log).toHaveBeenCalledWith('[auth][login] Backend failure', {
			requestId: 'login-request-123',
			reason
		});
		// fixed categories convey the cause without copying secrets from exception messages or forms.
		const output = JSON.stringify(log.mock.calls);
		expect(output).not.toContain('private-test-password');
		expect(output).not.toContain('diagnostic@example.invalid');
		expect(output).not.toContain('secret-value');
	});

	it('logs localhost backend failures too', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.localLogin.mockRejectedValue(
			new AuthServiceError(500, 'AUTH_CONFIG_MISSING', 'Missing secret')
		);
		await submit('dev', 'dev');
		expect(log).toHaveBeenCalledWith('[auth][login] Backend failure', {
			requestId: 'login-request-123',
			reason: 'AUTH_CONFIG_MISSING'
		});
	});

	it('logs missing database bindings before authentication starts', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await submit(undefined, undefined, false)).toMatchObject({ status: 500 });
		expect(mocks.login).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith('[auth][login] Backend failure', {
			requestId: 'login-request-123',
			reason: 'DATABASE_BINDING_MISSING'
		});
	});

	it.each([
		new AuthServiceError(500, 'AUTH_CONFIG_MISSING', 'Missing secret'),
		new Error('Internal backend details')
	])('keeps backend failures generic', async (error) => {
		mocks.login.mockRejectedValue(error);
		const result = await submit();
		expect(result).toMatchObject({
			status: 500,
			data: { errorCode: 'AUTH_LOGIN_UNAVAILABLE', errorStatus: 500 }
		});
		// browser responses must never include internal exception text.
		expect(JSON.stringify(result)).not.toContain(error.message);
	});
});
