/*
Brief description:
This file verifies how the dynamic PWA manifest chooses its theme color.

Deeper explanation:
An installed PWA can reuse manifest metadata during launches and refreshes, so the manifest route
must avoid drifting back to a generic fallback color when the current organization already has a
real theme. These tests keep the manifest tied to the current org first, then fall back to the
persisted browser theme only if the database theme is unavailable.

Summary of tests:
1. It verifies that the manifest uses the current organization's primary color when the theme exists.
2. It verifies that the manifest falls back to the persisted theme cookie if the database theme is unavailable.
3. It verifies that the final fallback stays on the PlayIMs default primary color instead of charcoal gray.
*/

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_THEME_COOKIE_KEY, serializeThemeColors } from '../../src/lib/theme';

const mocks = vi.hoisted(() => {
	return {
		getCentralDbOps: vi.fn(),
		getTenantDbOps: vi.fn(),
		ensureDefaultClient: vi.fn(),
		resolveClientId: vi.fn(),
		tenantDbOps: {
			themes: {
				getBySlug: vi.fn()
			}
		}
	};
});

vi.mock('$lib/server/database/context', () => {
	mocks.getCentralDbOps.mockReturnValue({});
	mocks.getTenantDbOps.mockResolvedValue(mocks.tenantDbOps);
	return {
		getCentralDbOps: mocks.getCentralDbOps,
		getTenantDbOps: mocks.getTenantDbOps
	};
});

vi.mock('$lib/server/client-context', () => {
	mocks.ensureDefaultClient.mockResolvedValue({
		id: 'client-1'
	});
	mocks.resolveClientId.mockReturnValue('client-1');
	return {
		ensureDefaultClient: mocks.ensureDefaultClient,
		resolveClientId: mocks.resolveClientId
	};
});

import { GET } from '../../src/routes/manifest.webmanifest/+server';

const createEvent = (cookieTheme?: string) => {
	const setHeaders = vi.fn();

	return {
		url: new URL('https://playims.test/manifest.webmanifest'),
		cookies: {
			get: (name: string) => (name === CURRENT_THEME_COOKIE_KEY ? cookieTheme : undefined)
		},
		setHeaders,
		locals: {
			session: {
				activeClientId: 'client-1'
			}
		},
		platform: {
			env: {
				DB: {}
			}
		}
	} as any;
};

describe('pwa manifest theme color', () => {
	beforeEach(() => {
		// clearing mocks between tests keeps the route outcome tied to each case's setup only.
		vi.clearAllMocks();
		mocks.tenantDbOps.themes.getBySlug.mockResolvedValue({
			id: 'current-theme',
			primary: '4A90E2'
		});
	});

	it('uses the current organization primary color when the theme exists', async () => {
		const response = await GET(createEvent());
		const payload = await response.json();

		expect(payload.theme_color).toBe('#4A90E2');
		expect(mocks.ensureDefaultClient).toHaveBeenCalled();
		expect(mocks.getTenantDbOps).toHaveBeenCalledWith(expect.anything(), 'client-1');
		expect(mocks.tenantDbOps.themes.getBySlug).toHaveBeenCalledWith('client-1', 'current');
	});

	it('falls back to the persisted theme cookie if the database theme is unavailable', async () => {
		// this mirrors a startup path where the browser still has the last good theme, but the
		// manifest route cannot reach the tenant theme yet.
		mocks.tenantDbOps.themes.getBySlug.mockResolvedValue(null);

		const response = await GET(
			createEvent(
				encodeURIComponent(
					serializeThemeColors({
						primary: '55AA33',
						secondary: '112233',
						neutral: ''
					})
				)
			)
		);
		const payload = await response.json();

		expect(payload.theme_color).toBe('#55AA33');
	});

	it('uses the PlayIMs default primary as the final fallback', async () => {
		// this keeps manifest launches from drifting to the old charcoal fallback when no better
		// theme source is available yet.
		mocks.getTenantDbOps.mockRejectedValueOnce(new Error('db unavailable'));

		const response = await GET(createEvent());
		const payload = await response.json();

		expect(payload.theme_color).toBe('#CE1126');
	});
});
