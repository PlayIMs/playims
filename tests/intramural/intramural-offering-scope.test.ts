/*
Brief description:
This file verifies the helper functions that resolve intramural offerings and leagues by slug.

Deeper explanation:
Intramural routing has to support both newer data and some older legacy data shapes. That means helper
functions sometimes need fallback behavior when a direct season match or direct slug match is not
available. These tests lock down that compatibility logic so future cleanup work does not strand older
records or break links that still rely on legacy naming patterns.

Summary of tests:
1. It verifies slug normalization and legacy league slug construction.
2. It verifies that offering resolution can fall back to legacy league-to-season matching.
3. It verifies that league resolution can fall back to the older offering-suffix slug pattern.
*/

import { describe, expect, it, vi } from 'vitest';
import {
	buildLegacyLeagueSlug,
	normalizeIntramuralSlug,
	resolveLeagueForOffering,
	resolveOfferingForSeason
} from '../../src/lib/server/intramural-offering-scope';

describe('intramural offering scope helpers', () => {
	it('normalizes slugs and builds legacy league suffixes', () => {
		// this protects the shared text-normalization contract used throughout the intramural routes.
		// if the slug cleanup rules drift, duplicate checks and route lookups can start disagreeing.
		expect(normalizeIntramuralSlug(' "Spring League!" ')).toBe('spring-league');
		expect(buildLegacyLeagueSlug('Competitive', 'Basketball')).toBe('competitive-basketball');
	});

	it('falls back to legacy league-to-season matches when resolving offerings', async () => {
		// this fake db setup intentionally makes the direct season lookup fail first.
		// the helper should then scan offerings and leagues to find the best legacy-compatible match.
		const dbOps = {
			offerings: {
				getByClientIdSeasonIdAndSlug: vi.fn().mockResolvedValue(null),
				getByClientId: vi.fn().mockResolvedValue([
					{ id: 'offering-1', slug: 'basketball', seasonId: 'season-0' },
					{ id: 'offering-2', slug: 'basketball', seasonId: 'season-2' }
				])
			},
			leagues: {
				getByClientId: vi.fn().mockResolvedValue([
					{
						id: 'league-1',
						offeringId: 'offering-2',
						seasonId: null,
						season: 'Spring',
						year: 2026
					}
				])
			}
		} as any;

		// the requested season is "season-1", but the matching offering belongs to "season-2".
		// the helper should still return it because a linked league carries the legacy season label
		// that matches "spring 2026".
		const offering = await resolveOfferingForSeason(
			dbOps,
			'client-1',
			{
				id: 'season-1',
				name: 'Spring 2026'
			} as any,
			'basketball'
		);

		expect(offering?.id).toBe('offering-2');
	});

	it('matches league slugs using the legacy offering suffix fallback', async () => {
		// direct slug lookup fails on purpose here so the helper must try the older
		// "league-slug-offering-slug" fallback convention.
		const dbOps = {
			leagues: {
				getByOfferingIdAndSlug: vi.fn().mockResolvedValue(null),
				getByOfferingId: vi.fn().mockResolvedValue([
					{
						id: 'league-1',
						name: 'Competitive',
						slug: 'competitive',
						seasonId: 'season-1'
					}
				])
			}
		} as any;

		const league = await resolveLeagueForOffering(
			dbOps,
			'client-1',
			{
				id: 'season-1',
				name: 'Spring 2026'
			} as any,
			{
				id: 'offering-1',
				slug: 'basketball'
			} as any,
			'competitive-basketball'
		);

		expect(league?.id).toBe('league-1');
	});
});
