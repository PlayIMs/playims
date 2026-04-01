/*
Brief description:
This file verifies the pure helper that chooses search palette scope behavior for dashboard contexts.

Deeper explanation:
The same palette is reused across intramural and club sports pages, but the season dropdown and query
parameter wiring need to switch domains when the user is inside `/dashboard/clubs`. These tests lock in
that routing contract so the palette can stay context-aware without embedding pathname conditionals all
over the component.

Summary of tests:
1. It verifies that club pages use the club season endpoint and club season query param.
2. It verifies that non-club pages keep the intramural season endpoint and query param.
*/

import { describe, expect, it } from 'vitest';

import { resolveSearchPaletteContext } from '../../src/lib/search/context';

describe('search palette context helper', () => {
	it('uses club season scoping on club sports pages', () => {
		// club pages should ask for club seasons and send club-specific scope params to search.
		expect(resolveSearchPaletteContext('/dashboard/clubs/2026-2027/ice-hockey')).toEqual({
			isClubSportsContext: true,
			seasonEndpoint: '/api/club-sports/seasons',
			seasonQueryParam: 'clubSeason'
		});
	});

	it('keeps intramural scoping elsewhere in the dashboard', () => {
		// offerings and non-club pages should continue using the existing intramural season source.
		expect(resolveSearchPaletteContext('/dashboard/offerings/fall-2026/basketball')).toEqual({
			isClubSportsContext: false,
			seasonEndpoint: '/api/intramural-sports/seasons',
			seasonQueryParam: 'season'
		});
	});
});
