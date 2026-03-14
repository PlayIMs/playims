/*
Brief description:
This file verifies the pure helper logic that powers mega search ranking, grouping, and deep links.

Deeper explanation:
Mega search needs stable, predictable behavior before any UI is layered on top. These tests lock in
the query normalization rules, the relevance ordering strategy, the group caps, and the href builders
that convert search matches into navigable destinations across the app.

Summary of tests:
1. It verifies that exact matches rank above prefix and substring matches.
2. It verifies that multi-term queries can match across punctuation and multiple result fields.
3. It verifies that grouped results enforce per-category and total caps.
4. It verifies that member, facility-area, and team href builders create the expected page state.
*/

import { describe, expect, it } from 'vitest';
import {
	buildFacilityAreaSearchHref,
	buildMemberSearchHref,
	buildTeamSearchHref,
	groupMegaSearchResults,
	scoreMegaSearchCandidate
} from '../../src/lib/search/utils';
import type { MegaSearchResult } from '../../src/lib/search/types';

describe('mega search helpers', () => {
	it('ranks exact matches above prefix and substring matches', () => {
		// the ranking helper should strongly prefer the cleanest user-intent match.
		const exact = scoreMegaSearchCandidate('fall', ['Fall']);
		const prefix = scoreMegaSearchCandidate('fall', ['Fall League']);
		const substring = scoreMegaSearchCandidate('fall', ['Late Fall League']);

		expect(exact).toBeGreaterThan(prefix);
		expect(prefix).toBeGreaterThan(substring);
	});

	it('matches multi-term queries across punctuation and secondary context fields', () => {
		// users naturally type a few loose words, so the scorer needs to combine them across title,
		// subtitle, and meta values while ranking fuller matches above partial context.
		const combinedMatch = scoreMegaSearchCandidate('corec softball division a', [
			'Division A',
			'Co-Rec',
			'Softball Fall 2026'
		]);
		const missingContext = scoreMegaSearchCandidate('corec softball division a', [
			'Division A',
			'Co-Rec',
			'Indoor Soccer Fall 2026'
		]);

		expect(combinedMatch).toBeGreaterThan(0);
		expect(combinedMatch).toBeGreaterThan(missingContext);
	});

	it('groups results with per-category and total caps', () => {
		// this keeps the palette readable by preventing one noisy category from crowding out everything else.
		const results = [
			{
				id: '1',
				resultKey: 'pages:/dashboard',
				category: 'pages',
				title: 'Dashboard',
				subtitle: null,
				href: '/dashboard',
				score: 300
			},
			{
				id: '2',
				resultKey: 'pages:/dashboard/facilities',
				category: 'pages',
				title: 'Facilities',
				subtitle: null,
				href: '/dashboard/facilities',
				score: 280
			},
			{
				id: '3',
				resultKey: 'pages:/dashboard/members',
				category: 'pages',
				title: 'Members',
				subtitle: null,
				href: '/dashboard/members',
				score: 260
			},
			{
				id: '4',
				resultKey: 'pages:/dashboard/settings',
				category: 'pages',
				title: 'Settings',
				subtitle: null,
				href: '/dashboard/settings',
				score: 240
			},
			{
				id: '5',
				resultKey: 'members:1',
				category: 'members',
				title: 'Jamie Member',
				subtitle: null,
				href: '/dashboard/members?memberId=1',
				score: 220
			},
			{
				id: '6',
				resultKey: 'members:2',
				category: 'members',
				title: 'Jordan Member',
				subtitle: null,
				href: '/dashboard/members?memberId=2',
				score: 210
			},
			{
				id: '7',
				resultKey: 'members:3',
				category: 'members',
				title: 'Chris Member',
				subtitle: null,
				href: '/dashboard/members?memberId=3',
				score: 205
			}
		] satisfies Array<MegaSearchResult & { score: number }>;

		const grouped = groupMegaSearchResults(results, {
			perCategoryLimit: 2,
			totalLimit: 3
		});

		expect(grouped.totalCount).toBe(3);
		expect(grouped.groups).toHaveLength(2);
		expect(grouped.groups[0]?.items.map((item) => item.id)).toEqual(['1', '2']);
		expect(grouped.groups[1]?.items.map((item) => item.id)).toEqual(['5']);
	});

	it('builds the expected deep-link hrefs for routed record results', () => {
		// these href builders are the contract between search results and page-state handling.
		expect(buildMemberSearchHref({ membershipId: 'member-1', fullName: 'Jamie Member' })).toBe(
			'/dashboard/members?memberId=member-1&q=Jamie+Member'
		);
		expect(
			buildFacilityAreaSearchHref({
				facilityId: 'facility-1',
				facilityAreaId: 'area-1'
			})
		).toBe('/dashboard/facilities?facilityId=facility-1&areaId=area-1');
		expect(
			buildTeamSearchHref({
				seasonSlug: 'fall-2026',
				offeringSlug: 'indoor-soccer',
				leagueSlug: 'co-rec',
				teamId: 'team-7'
			})
		).toBe('/dashboard/offerings/fall-2026/indoor-soccer/co-rec?teamId=team-7');
	});
});
