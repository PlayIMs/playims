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
6. It verifies that session history entries stay ordered and trim abandoned forward entries.
7. It verifies that back and forward history menus show the nearest routes first and cap at ten items.
8. It verifies that the URL bar displays a browser-like host and path string.
9. It verifies that URL bar submissions resolve full URLs, app paths, and simple hostnames.
10. It verifies that same-origin addresses produce SvelteKit goto targets while external ones stay full URLs.
*/

import { describe, expect, it } from 'vitest';
import {
	buildPwaAddressValue,
	selectPwaHistoryMenuEntries,
	readSvelteKitHistoryIndex,
	resolvePwaAddressNavigationTarget,
	resolvePwaAddressInput,
	syncPwaHistoryEntries,
	truncatePwaHistoryRoute,
	shouldSyncPwaAddressValue,
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

	it('stores ordered session history entries and drops abandoned forward routes after new navigation', () => {
		// this keeps the right-click history menu aligned with how browser history works after branching.
		const initialEntries = [
			{ index: 4, route: '/dashboard', label: '/dashboard', title: 'Dashboard' },
			{
				index: 5,
				route: '/dashboard/offerings',
				label: '/dashboard/offerings',
				title: 'Offerings'
			},
			{ index: 6, route: '/dashboard/teams', label: '/dashboard/teams', title: 'Teams' }
		];

		expect(
			syncPwaHistoryEntries({
				entries: initialEntries,
				currentIndex: 5,
				url: new URL('https://playims.com/dashboard/schedule'),
				title: 'Schedule',
				navigationType: 'goto'
			})
		).toEqual([
			{ index: 4, route: '/dashboard', label: '/dashboard', title: 'Dashboard' },
			{ index: 5, route: '/dashboard/schedule', label: '/dashboard/schedule', title: 'Schedule' }
		]);

		// popstate should keep future entries available because the user may still jump forward again.
		expect(
			syncPwaHistoryEntries({
				entries: initialEntries,
				currentIndex: 5,
				url: new URL('https://playims.com/dashboard/offerings?view=calendar'),
				title: 'Offerings Calendar',
				navigationType: 'popstate'
			})
		).toEqual([
			{ index: 4, route: '/dashboard', label: '/dashboard', title: 'Dashboard' },
			{
				index: 5,
				route: '/dashboard/offerings?view=calendar',
				label: '/dashboard/offerings?view=calendar',
				title: 'Offerings Calendar'
			},
			{ index: 6, route: '/dashboard/teams', label: '/dashboard/teams', title: 'Teams' }
		]);
	});

	it('returns the nearest ten routes for back and forward history menus', () => {
		// the menu should prioritize the next jump candidates instead of the oldest routes in the session.
		const entries = Array.from({ length: 14 }, (_, offset) => {
			const index = offset + 1;
			return {
				index,
				route: `/page-${index}`,
				label: `/page-${index}`,
				title: `Page ${index}`
			};
		});

		expect(
			selectPwaHistoryMenuEntries({
				entries,
				currentIndex: 11,
				direction: 'back'
			})
		).toEqual([
			{ index: 10, route: '/page-10', label: '/page-10', title: 'Page 10' },
			{ index: 9, route: '/page-9', label: '/page-9', title: 'Page 9' },
			{ index: 8, route: '/page-8', label: '/page-8', title: 'Page 8' },
			{ index: 7, route: '/page-7', label: '/page-7', title: 'Page 7' },
			{ index: 6, route: '/page-6', label: '/page-6', title: 'Page 6' },
			{ index: 5, route: '/page-5', label: '/page-5', title: 'Page 5' },
			{ index: 4, route: '/page-4', label: '/page-4', title: 'Page 4' },
			{ index: 3, route: '/page-3', label: '/page-3', title: 'Page 3' },
			{ index: 2, route: '/page-2', label: '/page-2', title: 'Page 2' },
			{ index: 1, route: '/page-1', label: '/page-1', title: 'Page 1' }
		]);

		expect(
			selectPwaHistoryMenuEntries({
				entries,
				currentIndex: 3,
				direction: 'forward'
			})
		).toEqual([
			{ index: 4, route: '/page-4', label: '/page-4', title: 'Page 4' },
			{ index: 5, route: '/page-5', label: '/page-5', title: 'Page 5' },
			{ index: 6, route: '/page-6', label: '/page-6', title: 'Page 6' },
			{ index: 7, route: '/page-7', label: '/page-7', title: 'Page 7' },
			{ index: 8, route: '/page-8', label: '/page-8', title: 'Page 8' },
			{ index: 9, route: '/page-9', label: '/page-9', title: 'Page 9' },
			{ index: 10, route: '/page-10', label: '/page-10', title: 'Page 10' },
			{ index: 11, route: '/page-11', label: '/page-11', title: 'Page 11' },
			{ index: 12, route: '/page-12', label: '/page-12', title: 'Page 12' },
			{ index: 13, route: '/page-13', label: '/page-13', title: 'Page 13' }
		]);
	});

	it('truncates long route paths to the first two and last two segments', () => {
		// this keeps the history menu compact while still showing enough of the route to recognize it.
		expect(truncatePwaHistoryRoute('/dashboard/dev')).toBe('/dashboard/dev');
		expect(truncatePwaHistoryRoute('/dashboard/offerings/fall-2026/leagues/open-rec/division-a')).toBe(
			'/dashboard/offerings/.../open-rec/division-a'
		);
		expect(
			truncatePwaHistoryRoute('/dashboard/offerings/fall-2026/leagues/open-rec/division-a?tab=schedule')
		).toBe('/dashboard/offerings/.../open-rec/division-a?tab=schedule');
		expect(truncatePwaHistoryRoute('/')).toBe('/');
	});

	it('builds a browser-like address value from the current page url', () => {
		// the bar should look like a real address field without the protocol prefix noise.
		expect(
			buildPwaAddressValue(
				new URL('https://playims.com/dashboard/offerings?sport=flag-football#current')
			)
		).toBe('playims.com/dashboard/offerings?sport=flag-football#current');
	});

	it('preserves a typed address while navigation is still in flight', () => {
		// this protects against resetting the field back to the old route before goto finishes.
		expect(
			shouldSyncPwaAddressValue({
				isEditing: false,
				navigationInFlight: true
			})
		).toBe(false);

		// once editing has ended and navigation is done, the field should mirror the live route again.
		expect(
			shouldSyncPwaAddressValue({
				isEditing: false,
				navigationInFlight: false
			})
		).toBe(true);
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
		expect(
			resolvePwaAddressInput('localhost:5180/dashboard/offerings', new URL('http://localhost:5180/dashboard'))
				?.href
		).toBe('http://localhost:5180/dashboard/offerings');
		expect(resolvePwaAddressInput('   ', currentUrl)).toBeNull();
	});

	it('builds goto-friendly targets for in-app addresses and full hrefs for external ones', () => {
		// the address bar should hand internal routes to SvelteKit and leave external urls to the browser.
		const currentUrl = new URL('https://playims.com/dashboard');

		expect(resolvePwaAddressNavigationTarget('/dashboard/settings?tab=teams', currentUrl)).toEqual({
			href: 'https://playims.com/dashboard/settings?tab=teams',
			route: '/dashboard/settings?tab=teams'
		});
		expect(resolvePwaAddressNavigationTarget('playims.com/members#captains', currentUrl)).toEqual({
			href: 'https://playims.com/members#captains',
			route: '/members#captains'
		});
		expect(
			resolvePwaAddressNavigationTarget(
				'localhost:5180/dashboard/offerings',
				new URL('http://localhost:5180/dashboard')
			)
		).toEqual({
			href: 'http://localhost:5180/dashboard/offerings',
			route: '/dashboard/offerings'
		});
		expect(resolvePwaAddressNavigationTarget('https://example.com/docs', currentUrl)).toEqual({
			href: 'https://example.com/docs',
			route: null
		});
	});
});
