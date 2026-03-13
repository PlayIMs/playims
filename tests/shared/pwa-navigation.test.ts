/*
Brief description:
This file verifies the standalone PWA detection helper used by the shared app shell.

Deeper explanation:
Installed PWAs do not always expose browser chrome, so the app has to decide for itself when to
render fallback navigation controls. That decision must stay predictable across standard browsers,
display-mode media queries, and iOS-style navigator flags. These tests protect that small contract
directly so layout changes can reuse the helper without guessing.

Summary of tests:
1. It verifies that the helper returns false when neither standalone signal is present.
2. It verifies that the display-mode media query enables standalone mode when it matches.
3. It verifies that the iOS navigator.standalone flag also enables standalone mode.
4. It verifies that matchMedia failures do not crash detection and instead fall back safely.
5. It verifies that SvelteKit history state can be read safely for back and forward controls.
6. It verifies that the URL bar displays a browser-like host and path string.
7. It verifies that URL bar submissions resolve full URLs, app paths, and simple hostnames.
*/

import { describe, expect, it } from 'vitest';
import {
	buildPwaAddressValue,
	readSvelteKitHistoryIndex,
	resolvePwaAddressInput,
	STANDALONE_DISPLAY_MODE_QUERY,
	SVELTEKIT_HISTORY_INDEX_KEY,
	isStandaloneDisplayMode
} from '../../src/lib/utils/pwa-navigation';

describe('pwa navigation helper', () => {
	it('returns false when no standalone signal is active', () => {
		// this baseline proves the helper does not accidentally show installed-app controls on the web.
		expect(
			isStandaloneDisplayMode({
				matchMedia: () => ({ matches: false }),
				navigatorStandalone: false
			})
		).toBe(false);
	});

	it('returns true when the standalone display-mode media query matches', () => {
		// this captures the modern browser path used by Chromium-based installed PWAs.
		expect(
			isStandaloneDisplayMode({
				matchMedia: (query) => {
					expect(query).toBe(STANDALONE_DISPLAY_MODE_QUERY);
					return { matches: true };
				},
				navigatorStandalone: false
			})
		).toBe(true);
	});

	it('returns true when navigator.standalone is enabled', () => {
		// this protects the iOS-style fallback where matchMedia may not be the active signal.
		expect(
			isStandaloneDisplayMode({
				matchMedia: () => ({ matches: false }),
				navigatorStandalone: true
			})
		).toBe(true);
	});

	it('falls back to false when matchMedia throws unexpectedly', () => {
		// this keeps the app shell resilient if a browser exposes the api but rejects the query call.
		expect(
			isStandaloneDisplayMode({
				matchMedia: () => {
					throw new Error('unsupported');
				},
				navigatorStandalone: false
			})
		).toBe(false);
	});

	it('reads the current SvelteKit history index when it exists', () => {
		// the shell uses this value to decide when back and forward buttons should be disabled.
		expect(readSvelteKitHistoryIndex({ [SVELTEKIT_HISTORY_INDEX_KEY]: 42 })).toBe(42);
		expect(readSvelteKitHistoryIndex({ [SVELTEKIT_HISTORY_INDEX_KEY]: '42' })).toBeNull();
		expect(readSvelteKitHistoryIndex(null)).toBeNull();
	});

	it('builds a browser-like address value from the current page url', () => {
		// the bar should look like a real address field without the protocol prefix noise.
		expect(
			buildPwaAddressValue(
				new URL('https://playims.com/dashboard/offerings?sport=flag-football#current')
			)
		).toBe('playims.com/dashboard/offerings?sport=flag-football#current');
	});

	it('resolves url bar submissions into the expected targets', () => {
		// these cases cover same-origin routes, pasted full urls, and bare hostnames.
		const currentUrl = new URL('https://playims.com/dashboard');

		expect(resolvePwaAddressInput('/dashboard/settings', currentUrl)?.href).toBe(
			'https://playims.com/dashboard/settings'
		);
		expect(resolvePwaAddressInput('https://example.com/docs', currentUrl)?.href).toBe(
			'https://example.com/docs'
		);
		expect(resolvePwaAddressInput('playims.com/schedule', currentUrl)?.href).toBe(
			'https://playims.com/schedule'
		);
		expect(resolvePwaAddressInput('members', currentUrl)?.href).toBe(
			'https://playims.com/members'
		);
		expect(resolvePwaAddressInput('   ', currentUrl)).toBeNull();
	});
});
