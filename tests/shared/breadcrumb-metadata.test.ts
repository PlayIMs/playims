/*
Brief description:
These tests verify the counts displayed beside breadcrumb navigation options.

Deeper explanation:
Navigation summaries must stay within the viewed season and count confirmed placements separately
from waitlists. Small fixtures make those distinctions visible without needing a database.

Summary of tests:
1. Divisions prefer confirmed teams and fall back to waitlists only when empty.
2. League and offering totals exclude waitlisted teams and other seasons.
3. Database reads are scoped to the selected leagues and organization.
4. Team and league labels use singular wording only for a count of one and omit zero counts.
5. Empty summaries disappear, while nonzero division lock counts remain visible.
6. Division labels include capacity without changing aggregate totals or waitlist fallbacks.
7. Locked divisions appear last with muted titles but remain navigable.
*/
import { describe, expect, it, vi } from 'vitest';
import { loadBreadcrumbMetadata } from '../../src/lib/server/breadcrumb-metadata';
import {
	breadcrumbTeamCountLabel,
	breadcrumbLeagueCountLabel,
	breadcrumbStats,
	breadcrumbDivisionOptions
} from '../../src/lib/components/navigation/breadcrumb';

describe('breadcrumb metadata', () => {
	it('groups locked divisions last without disabling or mutating options', () => {
		// stable grouping preserves the existing day/time order within each lock state.
		const options = [
			{ value: 'locked-one', label: 'Monday', labelClass: 'custom' },
			{ value: 'open-one', label: 'Tuesday' },
			{ value: 'locked-two', label: 'Wednesday' },
			{ value: 'open-two', label: 'Thursday' }
		];
		const result = breadcrumbDivisionOptions(options, (value) => ({
			teamCount: 0,
			isLocked: value.startsWith('locked')
		}));
		expect(result.map((option) => option.value)).toEqual([
			'open-one',
			'open-two',
			'locked-one',
			'locked-two'
		]);
		expect(result[2].labelClass).toBe('custom opacity-50');
		expect(result[3].labelClass).toBe('opacity-50');
		expect(result.every((option) => !option.disabled)).toBe(true);
		expect(options[0].labelClass).toBe('custom');
		expect(options[0].value).toBe('locked-one');
	});
	it('shows confirmed division occupancy against capacity', () => {
		// capacity is the total number of available team slots, not the waitlist size.
		expect(breadcrumbTeamCountLabel({ teamCount: 1, maxTeams: 4 })).toBe('1 / 4 Teams');
		expect(breadcrumbTeamCountLabel({ teamCount: 1, maxTeams: 1 })).toBe('1 / 1 Team');
		expect(breadcrumbTeamCountLabel({ teamCount: 5, maxTeams: 4 })).toBe('5 / 4 Teams');
		expect(breadcrumbTeamCountLabel({ teamCount: 0, maxTeams: 4, waitlistCount: 2 })).toBe(
			'2 Waitlisted'
		);
		expect(breadcrumbTeamCountLabel({ teamCount: 0, maxTeams: 4 })).toBe('');
		expect(breadcrumbTeamCountLabel({ teamCount: 1, maxTeams: null })).toBe('1 Team');
		expect(breadcrumbTeamCountLabel({ teamCount: 1, maxTeams: 0 })).toBe('1 Team');
	});
	it.each([0, 1, 2])('uses the correct team and league wording for %i', (count) => {
		// empty counts disappear; exactly one uses the singular noun.
		expect(breadcrumbTeamCountLabel({ teamCount: count })).toBe(
			count === 0 ? '' : `${count} ${count === 1 ? 'Team' : 'Teams'}`
		);
		expect(breadcrumbLeagueCountLabel(count)).toBe(
			count === 0 ? '' : `${count} ${count === 1 ? 'League' : 'Leagues'}`
		);
	});
	it('displays confirmed totals, waitlist-only totals, and empty divisions', () => {
		// a waitlist is only useful as the fallback when no confirmed teams exist.
		expect(breadcrumbTeamCountLabel({ teamCount: 5, waitlistCount: 2 })).toBe('5 Teams');
		expect(breadcrumbTeamCountLabel({ teamCount: 0, waitlistCount: 2 })).toBe('2 Waitlisted');
		expect(breadcrumbTeamCountLabel({ teamCount: 0, waitlistCount: 0 })).toBe('');
	});
	it('omits zero stats independently and hides completely empty summaries', () => {
		// the renderable list prevents empty labels or orphaned lock icons from taking up space.
		expect(breadcrumbStats({ leagueCount: 3, teamCount: 0 })).toEqual([
			{ kind: 'text', label: '3 Leagues' }
		]);
		expect(breadcrumbStats({ leagueCount: 0, teamCount: 1 })).toEqual([
			{ kind: 'text', label: '1 Team' }
		]);
		expect(breadcrumbStats({ leagueCount: 0, teamCount: 0 })).toEqual([]);
		expect(breadcrumbStats({ unlockedCount: 0, lockedCount: 0, teamCount: 0 })).toEqual([]);
		expect(breadcrumbStats({ unlockedCount: 0, lockedCount: 2, teamCount: 0 })).toEqual([
			{ kind: 'locked', label: '2' }
		]);
		expect(breadcrumbStats({ unlockedCount: 3, lockedCount: 0, teamCount: 1 })).toEqual([
			{ kind: 'unlocked', label: '3' },
			{ kind: 'text', label: '1 Team' }
		]);
		expect(breadcrumbStats({ teamCount: 0, waitlistCount: 1 })).toEqual([
			{ kind: 'text', label: '1 Waitlisted' }
		]);
	});
	it('counts confirmed teams, waitlist fallbacks, and season-scoped totals', async () => {
		// mixed statuses expose accidental inclusion of waitlists in confirmed totals.
		const divisions = [
			{ id: 'd1', leagueId: 'l1', slug: 'one', isLocked: 0, maxTeams: 4 },
			{ id: 'd2', leagueId: 'l1', slug: 'two', isLocked: 1 },
			{ id: 'd3', leagueId: 'l1', slug: 'empty', isLocked: 0 }
		];
		const db = {
			divisions: { getByLeagueIds: vi.fn().mockResolvedValue(divisions) },
			teams: {
				getByClientIdAndDivisionIds: vi.fn().mockResolvedValue([
					{ divisionId: 'd1', teamStatus: 'active' },
					{ divisionId: 'd1', teamStatus: 'waitlist' },
					{ divisionId: 'd2', teamStatus: 'waitlist' },
					{ divisionId: 'd2', teamStatus: 'waitlisted' },
					{ divisionId: 'd1', teamStatus: 'removed' }
				])
			}
		};
		const result = await loadBreadcrumbMetadata(
			db,
			'client',
			{
				id: 'season',
				name: 'Fall',
				slug: 'fall'
			},
			[{ id: 'o1', slug: 'basketball', seasonId: 'season' }],
			[
				{ id: 'l1', offeringId: 'o1', seasonId: 'season', slug: 'competitive' },
				{ id: 'other', offeringId: 'o1', seasonId: 'other-season', slug: 'other' }
			]
		);
		const root = '/dashboard/offerings/fall/basketball';
		expect(result[root]).toEqual({ leagueCount: 1, teamCount: 1 });
		expect(result[`${root}/competitive`]).toEqual({
			unlockedCount: 2,
			lockedCount: 1,
			teamCount: 1
		});
		expect(result[`${root}/competitive/one`]).toEqual({
			teamCount: 1,
			waitlistCount: 1,
			maxTeams: 4,
			isLocked: false
		});
		expect(result[`${root}/competitive/two`]).toEqual({
			teamCount: 0,
			waitlistCount: 2,
			isLocked: true
		});
		expect(result[`${root}/competitive/empty`]).toEqual({
			teamCount: 0,
			waitlistCount: 0,
			isLocked: false
		});
		expect(db.divisions.getByLeagueIds).toHaveBeenCalledWith(['l1']);
		expect(db.teams.getByClientIdAndDivisionIds).toHaveBeenCalledWith('client', ['d1', 'd2', 'd3']);
		expect(result[`${root}/other`]).toBeUndefined();
	});
});
