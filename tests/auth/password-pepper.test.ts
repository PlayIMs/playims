import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePasswordPepper } from '../../src/lib/server/auth/service';

describe('password pepper resolution', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('prefers AUTH_PASSWORD_PEPPER when configured', () => {
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
