/*
Brief description:
This file verifies the shared offerings sidebar timeline helpers that build grouped timeline events.

Deeper explanation:
The offerings page sidebar now needs to merge several different league milestones into one ordered
timeline while still preserving deterministic grouping and auto-scroll behavior. These tests protect
the shared helper contract so future refactors do not accidentally drop event types, reshuffle tied
events, or point the auto-scroll logic at the wrong timeline group.

Summary of tests:
1. It verifies that all supported milestone types are converted into grouped timeline events.
2. It verifies that null and invalid dates are skipped instead of creating broken timeline rows.
3. It verifies that same-timestamp events stay grouped and use the required deterministic ordering.
4. It verifies that past and upcoming groups are marked relative to the injected current time.
5. It verifies that the helper returns the first upcoming group for auto-scroll targeting.
6. It verifies that the initial-scroll helper falls back to the most recent past group when needed.
7. It verifies that no upcoming group is returned when every event is already in the past.
8. It verifies that the compact timeline event labels use the correct past and future wording.
9. It verifies that the shared relative-day helper returns human-readable day labels.
*/

import { describe, expect, it } from 'vitest';

import {
	buildOfferingTimelineGroups,
	formatTimelineRelativeDayLabel,
	findInitialTimelineGroup,
	findFirstUpcomingTimelineGroup,
	getTimelineEventCompactLabel,
	type OfferingTimelineLeagueSource
} from '../../src/lib/utils/offering-sidebar-timeline';

function createLeagueSource(
	overrides: Partial<OfferingTimelineLeagueSource> = {}
): OfferingTimelineLeagueSource {
	return {
		leagueId: 'league-1',
		leagueName: 'Mens Competitive',
		categoryLabel: 'Mens Competitive',
		offeringName: 'Basketball',
		offeringSlug: 'basketball',
		registrationDeadlineDate: '2026-02-20T18:00:00',
		registrationDeadlineLabel: 'Closes Feb 20, 6:00 PM',
		joinTeamDate: '2026-02-21T18:00:00',
		joinTeamLabel: 'Join by Feb 21, 6:00 PM',
		seasonStartDate: '2026-02-21T18:00:00',
		seasonStartLabel: 'Starts Feb 21, 6:00 PM',
		seasonEndDate: '2026-03-18T19:00:00',
		seasonEndLabel: 'Ends Mar 18, 7:00 PM',
		...overrides
	};
}

describe('offerings sidebar timeline helpers', () => {
	it('builds grouped timeline entries for all supported milestone types', () => {
		// this protects the intended four-event timeline surface for each league.
		const groups = buildOfferingTimelineGroups([createLeagueSource()], new Date('2026-02-01T12:00:00'));

		expect(groups).toHaveLength(3);
		expect(groups.map((group) => group.date)).toEqual([
			'2026-02-20T18:00:00',
			'2026-02-21T18:00:00',
			'2026-03-18T19:00:00'
		]);
		expect(groups.map((group) => group.events.map((event) => event.type))).toEqual([
			['registration-deadline'],
			['join-team-deadline', 'season-start'],
			['season-end']
		]);
	});

	it('skips null and invalid dates instead of creating broken timeline rows', () => {
		// this keeps partial or malformed league data from rendering empty timeline anchors.
		const groups = buildOfferingTimelineGroups(
			[
				createLeagueSource({
					registrationDeadlineDate: null,
					joinTeamDate: 'not-a-date',
					seasonStartDate: null,
					seasonEndDate: '2026-03-18T19:00:00'
				})
			],
			new Date('2026-02-01T12:00:00')
		);

		expect(groups).toHaveLength(1);
		expect(groups[0]?.events.map((event) => event.type)).toEqual(['season-end']);
	});

	it('keeps same-timestamp events grouped and sorted by event type, offering name, then league label', () => {
		// deterministic tie-breaking prevents the sidebar from visually jumping between renders.
		const groups = buildOfferingTimelineGroups(
			[
				createLeagueSource({
					leagueId: 'league-b',
					categoryLabel: 'Zeta League',
					joinTeamDate: '2026-02-21T18:00:00',
					seasonStartDate: '2026-02-21T18:00:00'
				}),
				createLeagueSource({
					leagueId: 'league-a',
					offeringName: 'Archery',
					offeringSlug: 'archery',
					categoryLabel: 'Alpha Flight',
					registrationDeadlineDate: '2026-02-21T18:00:00',
					joinTeamDate: '2026-02-21T18:00:00',
					seasonStartDate: '2026-02-21T18:00:00',
					seasonEndDate: null
				})
			],
			new Date('2026-02-01T12:00:00')
		);

		const targetGroup = groups.find((group) => group.date === '2026-02-21T18:00:00');
		expect(targetGroup?.events.map((event) => `${event.type}:${event.offeringName}:${event.categoryLabel}`))
			.toEqual([
				'registration-deadline:Archery:Alpha Flight',
				'join-team-deadline:Archery:Alpha Flight',
				'join-team-deadline:Basketball:Zeta League',
				'season-start:Archery:Alpha Flight',
				'season-start:Basketball:Zeta League'
			]);
	});

	it('marks groups as past or upcoming relative to the injected current time', () => {
		// the sidebar styling depends on this flag to fade historical milestones without hiding them.
		const groups = buildOfferingTimelineGroups([createLeagueSource()], new Date('2026-02-21T12:00:00'));

		expect(groups.map((group) => ({ date: group.date, isPast: group.isPast }))).toEqual([
			{ date: '2026-02-20T18:00:00', isPast: true },
			{ date: '2026-02-21T18:00:00', isPast: false },
			{ date: '2026-03-18T19:00:00', isPast: false }
		]);
	});

	it('returns the first upcoming group for auto-scroll targeting', () => {
		// the page uses this to place the next relevant milestone at the top of the scrollable panel.
		const groups = buildOfferingTimelineGroups([createLeagueSource()], new Date('2026-02-21T12:00:00'));

		expect(findFirstUpcomingTimelineGroup(groups)?.date).toBe('2026-02-21T18:00:00');
		expect(findInitialTimelineGroup(groups)?.date).toBe('2026-02-21T18:00:00');
	});

	it('falls back to the most recent past group when every event is already historical', () => {
		// historical seasons should open on the latest completed milestone instead of the oldest one.
		const groups = buildOfferingTimelineGroups([createLeagueSource()], new Date('2026-04-01T12:00:00'));

		expect(findInitialTimelineGroup(groups)?.date).toBe('2026-03-18T19:00:00');
	});

	it('returns null when every timeline group is already in the past', () => {
		// this keeps the lower-level upcoming-only helper honest for callers that need strict future detection.
		const groups = buildOfferingTimelineGroups([createLeagueSource()], new Date('2026-04-01T12:00:00'));

		expect(findFirstUpcomingTimelineGroup(groups)).toBeNull();
	});

	it('uses the expected compact labels for past and future season events', () => {
		// this keeps the sidebar wording aligned with the product language instead of drifting during refactors.
		expect(getTimelineEventCompactLabel('season-start', false)).toBe('Season Starts');
		expect(getTimelineEventCompactLabel('season-end', false)).toBe('Season Ends');
		expect(getTimelineEventCompactLabel('season-start', true)).toBe('Season Started');
		expect(getTimelineEventCompactLabel('season-end', true)).toBe('Season Ended');
	});

	it('formats relative day labels with friendly calendar phrasing', () => {
		// this locks in the human-readable day copy that appears beside each timeline date header.
		const now = new Date('2026-04-02T09:00:00');

		expect(formatTimelineRelativeDayLabel('2026-04-02T19:00:00', now)).toBe('today');
		expect(formatTimelineRelativeDayLabel('2026-04-03T19:00:00', now)).toBe('tomorrow');
		expect(formatTimelineRelativeDayLabel('2026-04-01T19:00:00', now)).toBe('yesterday');
		expect(formatTimelineRelativeDayLabel('2026-04-04T19:00:00', now)).toBe('in 2 days');
		expect(formatTimelineRelativeDayLabel('2026-03-31T19:00:00', now)).toBe('2 days ago');
	});
});
