/*
Brief description:
This file verifies how the authentication service resolves the password pepper secret.

Deeper explanation:
Password hashing depends on a server-side secret, and the service supports a fallback for older
environments that only define the session secret. These tests protect both the preferred path and
the warning-producing fallback so configuration changes do not silently weaken or break login.

Summary of tests:
1. It verifies that AUTH_PASSWORD_PEPPER is preferred when it is configured.
2. It verifies that AUTH_SESSION_SECRET is used as a fallback and emits a warning.
*/

import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePasswordPepper } from '../../src/lib/server/auth/service';

describe('password pepper resolution', () => {
	afterEach(() => {
		// restoring the warning spy keeps console state clean across tests.
		vi.restoreAllMocks();
	});

	it('prefers AUTH_PASSWORD_PEPPER when configured', () => {
		// warning output is part of the contract here, so the spy verifies the quiet preferred path.
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const event = {
			platform: {
				env: {
					AUTH_PASSWORD_PEPPER: 'pepper-value',
					AUTH_SESSION_SECRET: 'session-secret-value'
				}
			}
		} as any;

		const pepper = resolvePasswordPepper(event);
		expect(pepper).toBe('pepper-value');
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it('falls back to AUTH_SESSION_SECRET and warns', () => {
		// this covers older environments where the dedicated pepper has not been set yet.
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const event = {
			platform: {
				env: {
					AUTH_SESSION_SECRET: 'session-secret-value'
				}
			}
		} as any;

		const pepper = resolvePasswordPepper(event);
		expect(pepper).toBe('session-secret-value');
		expect(warnSpy).toHaveBeenCalled();
	});
});
