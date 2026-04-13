/*
Brief description:
This file verifies the shared helper logic that powers the dashboard schedule page.

Deeper explanation:
The schedule page now depends on shared filtering and calendar helpers instead of embedding all of
its date math and option pruning directly in the route. These tests protect the behavior that keeps
the cascading filters valid, places events into the correct calendar buckets, preserves the
expected day, week, and month ranges, and keeps the top date navigator aligned around the selected
day, week, or month.

Summary of tests:
1. It verifies invalid lower-level schedule filters are cleared when a higher-level filter changes.
2. It verifies team filtering matches events where the selected team is either home or away.
3. It verifies centered day-strip, week-strip, month-strip, range, and month helpers stay aligned around the selected date.
4. It verifies custom date ranges normalize cleanly, count inclusive days, and stay shareable in the URL.
5. It verifies the URL-sync helper removes default schedule params and no-ops once the URL matches.
6. It verifies page-level keyboard shortcuts stay idle while dropdowns, pickers, or text entry are active.
7. It verifies the navigator focus target stays on the anchored date except for the custom range view.
8. It verifies the simple day navigator maps arrow-key combinations to the expected day and week jumps.
9. It verifies unscheduled events stay out of dated agenda buckets and month cells.
*/

import { describe, expect, it } from 'vitest';

import {
	bucketScheduleEventsByTiming,
	buildNextScheduleHref,
	buildCenteredScheduleDays,
	buildCenteredScheduleMonths,
	buildCenteredScheduleWeeks,
	buildScheduleDateIndex,
	buildScheduleAgendaBuckets,
	buildMonthScheduleCells,
	countScheduleRangeDays,
	filterScheduleEvents,
	getScheduleRangeForView,
	normalizeScheduleDateRange,
	resolveScheduleNavigatorFocusDateKey,
	resolveScheduleKeyboardShortcutMove,
	resolveScheduleNavigatorDirection,
	sanitizeScheduleFilters,
	shouldHandleScheduleKeyboardNavigation,
	type ScheduleEventRecord,
	type ScheduleFilters,
	type ScheduleView
} from '../../src/lib/utils/schedule-page';

function createFilters(overrides?: Partial<ScheduleFilters>): ScheduleFilters {
	return {
		seasonId: 'all',
		offeringId: 'all',
		leagueId: 'all',
		divisionId: 'all',
		teamId: 'all',
		status: 'all',
		searchQuery: '',
		...(overrides ?? {})
	};
}

function createEvent(overrides?: Partial<ScheduleEventRecord>): ScheduleEventRecord {
	return {
		id: 'event-1',
		type: 'game',
		status: 'scheduled',
		statusLabel: 'Scheduled',
		rawStatus: 'scheduled',
		scheduledStartAt: '2026-03-18T18:00:00',
		scheduledEndAt: '2026-03-18T19:00:00',
		seasonId: 'season-spring',
		seasonName: 'Spring 2026',
		offeringId: 'offering-basketball',
		offeringName: 'Basketball',
		leagueId: 'league-mens',
		leagueName: "Men's Competitive",
		divisionId: 'division-monday',
		divisionName: 'Monday 6 PM',
		homeTeamId: 'team-wildcats',
		homeTeamName: 'Wildcats',
		awayTeamId: 'team-falcons',
		awayTeamName: 'Falcons',
		matchup: 'Wildcats vs Falcons',
		facilityId: 'facility-main',
		facilityName: 'Main Gym',
		facilityAreaId: 'area-court-a',
		facilityAreaName: 'Court A',
		location: 'Main Gym - Court A',
		weekNumber: 2,
		roundLabel: 'Regular Season',
		notes: null,
		isPostseason: false,
		score: null,
		scoreSortValue: 0,
		...(overrides ?? {})
	};
}

describe('schedule page helpers', () => {
	const events = [
		createEvent(),
		createEvent({
			id: 'event-2',
			scheduledStartAt: '2026-03-20T20:00:00',
			scheduledEndAt: '2026-03-20T21:00:00',
			divisionId: 'division-wednesday',
			divisionName: 'Wednesday 8 PM',
			homeTeamId: 'team-falcons',
			homeTeamName: 'Falcons',
			awayTeamId: 'team-bears',
			awayTeamName: 'Bears',
			matchup: 'Falcons vs Bears'
		}),
		createEvent({
			id: 'event-3',
			status: 'completed',
			statusLabel: 'Completed',
			rawStatus: 'completed',
			seasonId: 'season-fall',
			seasonName: 'Fall 2026',
			offeringId: 'offering-volleyball',
			offeringName: 'Volleyball',
			leagueId: 'league-coed',
			leagueName: 'Coed Rec',
			divisionId: 'division-thursday',
			divisionName: 'Thursday 7 PM',
			homeTeamId: 'team-spikes',
			homeTeamName: 'Spikes',
			awayTeamId: 'team-aces',
			awayTeamName: 'Aces',
			matchup: 'Spikes vs Aces',
			scheduledStartAt: '2026-04-03T19:00:00',
			scheduledEndAt: '2026-04-03T20:00:00'
		}),
		createEvent({
			id: 'event-4',
			scheduledStartAt: null,
			scheduledEndAt: null,
			homeTeamId: 'team-wildcats',
			homeTeamName: 'Wildcats',
			awayTeamId: 'team-bears',
			awayTeamName: 'Bears',
			matchup: 'Wildcats vs Bears'
		})
	];

	it('clears invalid lower-level selections when higher-level filters change', () => {
		// this keeps the sidebar from staying stuck on impossible combinations after a parent filter changes.
		expect(
			sanitizeScheduleFilters(
				events,
				createFilters({
					seasonId: 'season-spring',
					offeringId: 'offering-volleyball',
					leagueId: 'league-coed',
					divisionId: 'division-thursday',
					teamId: 'team-spikes'
				})
			)
		).toEqual(
			createFilters({
				seasonId: 'season-spring'
			})
		);
	});

	it('matches team filters against both home and away teams', () => {
		// schedule filtering should feel natural even when the chosen team appears on either side of the matchup.
		expect(
			filterScheduleEvents(
				events,
				createFilters({
					teamId: 'team-falcons'
				})
			).map((event) => event.id)
		).toEqual(['event-1', 'event-2']);
	});

	it('builds centered day strips, week strips, month strips, ranges, and month cells around the selected date', () => {
		// this protects the navigator so the highlighted day, week, or month stays aligned while the related views stay in sync.
		const dateIndex = buildScheduleDateIndex(events);
		const centeredDays = buildCenteredScheduleDays('2026-03-18', 3);
		const centeredWeeks = buildCenteredScheduleWeeks('2026-04-02');
		const centeredMonths = buildCenteredScheduleMonths('2026-04-14');
		const weekRange = getScheduleRangeForView('2026-03-18', 'week' satisfies ScheduleView);
		const monthCells = buildMonthScheduleCells(events, '2026-03-18');
		const marchEighteenthCell = monthCells.find((cell) => cell.dateKey === '2026-03-18');

		expect(centeredDays.map((day) => day.dateKey)).toEqual([
			'2026-03-15',
			'2026-03-16',
			'2026-03-17',
			'2026-03-18',
			'2026-03-19',
			'2026-03-20',
			'2026-03-21'
		]);
		expect(centeredDays[3]).toMatchObject({
			dateKey: '2026-03-18',
			dayNumber: '18',
			monthLabel: 'Mar'
		});
		expect(centeredWeeks.map((week) => week.rangeLabel)).toEqual([
			'8-14',
			'15-21',
			'22-28',
			'29-4',
			'5-11',
			'12-18'
		]);
		expect(centeredWeeks[3]).toMatchObject({
			startDate: '2026-03-29',
			endDate: '2026-04-04',
			monthLabel: 'Mar'
		});
		expect(centeredMonths.map((month) => month.rangeLabel)).toEqual([
			'1-31',
			'1-28',
			'1-31',
			'1-30',
			'1-31',
			'1-30',
			'1-31'
		]);
		expect(centeredMonths[3]).toMatchObject({
			startDate: '2026-04-01',
			endDate: '2026-04-30',
			monthLabel: 'Apr'
		});
		expect(weekRange).toEqual({
			startDate: '2026-03-15',
			endDate: '2026-03-21'
		});
		expect(dateIndex.scheduledByDate.get('2026-03-18')?.map((event) => event.id)).toEqual([
			'event-1'
		]);
		expect(monthCells).toHaveLength(42);
		expect(marchEighteenthCell?.events.map((event) => event.id)).toEqual(['event-1']);
	});

	it('builds stable schedule urls so the page does not keep rewriting identical history state', () => {
		// this protects the client page from reactive url loops by proving the chosen view stays shareable and repeated syncs become a no-op.
		const nextHref = buildNextScheduleHref('https://example.com/dashboard/schedule', {
			searchQuery: '',
			selectedSeasonId: 'season-spring',
			defaultSeasonId: 'season-spring',
			selectedOfferingId: 'all',
			selectedLeagueId: 'all',
			selectedDivisionId: 'all',
			selectedView: 'day',
			defaultView: 'day',
			anchorDate: '2026-03-18',
			selectedMonthDate: '2026-03-18',
			selectedRangeStartDate: '2026-03-18',
			selectedRangeEndDate: '2026-03-18',
			today: '2026-03-18'
		});

		expect(nextHref).toBe('/dashboard/schedule?view=day');
		expect(
			buildNextScheduleHref(`https://example.com${nextHref}`, {
				searchQuery: '',
				selectedSeasonId: 'season-spring',
				defaultSeasonId: 'season-spring',
				selectedOfferingId: 'all',
				selectedLeagueId: 'all',
				selectedDivisionId: 'all',
				selectedView: 'day',
				defaultView: 'day',
				anchorDate: '2026-03-18',
				selectedMonthDate: '2026-03-18',
				selectedRangeStartDate: '2026-03-18',
				selectedRangeEndDate: '2026-03-18',
				today: '2026-03-18'
			})
		).toBeNull();
	});

	it('normalizes custom date ranges, counts inclusive days, and keeps them shareable', () => {
		// this keeps the custom range view predictable even when the user picks the end date before the start date.
		const normalizedRange = normalizeScheduleDateRange('2026-04-10', '2026-04-03', '2026-04-01');
		const nextHref = buildNextScheduleHref('https://example.com/dashboard/schedule', {
			searchQuery: '',
			selectedSeasonId: 'season-spring',
			defaultSeasonId: 'season-spring',
			selectedOfferingId: 'all',
			selectedLeagueId: 'all',
			selectedDivisionId: 'all',
			selectedView: 'date-range',
			defaultView: 'day',
			anchorDate: normalizedRange.startDate,
			selectedMonthDate: normalizedRange.startDate,
			selectedRangeStartDate: normalizedRange.startDate,
			selectedRangeEndDate: normalizedRange.endDate,
			today: '2026-04-01'
		});

		expect(normalizedRange).toEqual({
			startDate: '2026-04-03',
			endDate: '2026-04-10'
		});
		expect(countScheduleRangeDays(normalizedRange)).toBe(8);
		expect(nextHref).toBe(
			'/dashboard/schedule?view=date-range&date=2026-04-03&startDate=2026-04-03&endDate=2026-04-10'
		);
	});

	it('only enables page-level keyboard navigation when interactive controls are idle', () => {
		// this keeps global arrow shortcuts from stealing caret movement or menu navigation from open controls.
		expect(
			shouldHandleScheduleKeyboardNavigation({
				key: 'ArrowLeft',
				hasOpenDatePicker: false,
				hasOpenDropdown: false,
				isEditableTarget: false
			})
		).toBe(true);
		expect(
			shouldHandleScheduleKeyboardNavigation({
				key: 'ArrowLeft',
				hasOpenDatePicker: true,
				hasOpenDropdown: false,
				isEditableTarget: false
			})
		).toBe(false);
		expect(
			shouldHandleScheduleKeyboardNavigation({
				key: 'ArrowRight',
				hasOpenDatePicker: false,
				hasOpenDropdown: true,
				isEditableTarget: false
			})
		).toBe(false);
		expect(
			shouldHandleScheduleKeyboardNavigation({
				key: 'ArrowRight',
				hasOpenDatePicker: false,
				hasOpenDropdown: false,
				isEditableTarget: true
			})
		).toBe(false);
	});

	it('keeps navigator focus on the anchored date except in custom range mode', () => {
		// this makes the page-level shortcuts usable right away instead of bouncing focus back to the search box.
		expect(resolveScheduleNavigatorFocusDateKey('day', '2026-04-12')).toBe('2026-04-12');
		expect(resolveScheduleNavigatorFocusDateKey('week', '2026-04-12')).toBe('2026-04-12');
		expect(resolveScheduleNavigatorFocusDateKey('month', '2026-04-12')).toBe('2026-04-12');
		expect(resolveScheduleNavigatorFocusDateKey('entire-season', '2026-04-12')).toBe('2026-04-12');
		expect(resolveScheduleNavigatorFocusDateKey('date-range', '2026-04-12')).toBeNull();
	});

	it('maps simple navigator arrow keys to the expected day and week movement', () => {
		// this keeps keyboard navigation predictable so plain arrows move one day and shift-arrows move one week.
		expect(resolveScheduleNavigatorDirection('ArrowLeft')).toBe(-1);
		expect(resolveScheduleNavigatorDirection('ArrowRight')).toBe(1);
		expect(resolveScheduleNavigatorDirection('ArrowLeft', true)).toBe(-7);
		expect(resolveScheduleNavigatorDirection('ArrowRight', true)).toBe(7);
		expect(resolveScheduleNavigatorDirection('Enter')).toBeNull();
		expect(resolveScheduleKeyboardShortcutMove('ArrowLeft')).toEqual({
			unit: 'day',
			direction: -1
		});
		expect(resolveScheduleKeyboardShortcutMove('ArrowRight')).toEqual({
			unit: 'day',
			direction: 1
		});
		expect(resolveScheduleKeyboardShortcutMove('ArrowLeft', true)).toEqual({
			unit: 'week',
			direction: -1
		});
		expect(resolveScheduleKeyboardShortcutMove('ArrowRight', true)).toEqual({
			unit: 'week',
			direction: 1
		});
		expect(resolveScheduleKeyboardShortcutMove('Enter')).toBeNull();
	});

	it('keeps unscheduled events out of agenda buckets and month cells while returning them separately', () => {
		// unscheduled rows should never appear in date-based views even though the helper still tracks them separately.
		const buckets = bucketScheduleEventsByTiming(events);
		const agendaBuckets = buildScheduleAgendaBuckets(events, {
			startDate: '2026-03-17',
			endDate: '2026-03-20'
		});
		const monthCells = buildMonthScheduleCells(events, '2026-03-18');

		expect(buckets.unscheduled.map((event) => event.id)).toEqual(['event-4']);
		expect(agendaBuckets.map((bucket) => bucket.dateKey)).toEqual(['2026-03-18', '2026-03-20']);
		expect(agendaBuckets.flatMap((bucket) => bucket.events.map((event) => event.id))).toEqual([
			'event-1',
			'event-2'
		]);
		expect(monthCells.some((cell) => cell.events.some((event) => event.id === 'event-4'))).toBe(
			false
		);
	});
});
