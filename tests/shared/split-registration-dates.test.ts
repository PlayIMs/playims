/*
Brief description:
This file verifies split registration fields and late registration validation.

Deeper explanation:
Separate date and time controls must still produce the existing combined API value. Registration
may remain open after a season starts, while each individual date range must still be ordered.

Summary of tests:
1. It verifies that changing one datetime part preserves the other part and allows partial drafts.
2. It verifies late registration for league creation and editing without removing range safeguards.
3. It verifies that creation routes share date-only calendars and the intended keyboard order.
4. It verifies season timestamps without breaking legacy date-only payloads.
*/
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { replaceDateTimePart, splitDateTimeValue } from '../../src/lib/components/date-time-parts';
import {
	createIntramuralLeagueSchema,
	updateIntramuralLeagueSchema
} from '../../src/lib/server/intramural-offerings-validation';

function league(overrides = {}) {
	// use a complete valid fixture so each failure isolates one scheduling rule.
	return {
		name: 'Open',
		slug: 'open',
		stackOrder: 1,
		description: null,
		seasonId: 'season-1',
		gender: 'mixed',
		skillLevel: 'all',
		regStartDate: '2026-08-01T00:00',
		regEndDate: '2026-09-15T23:59',
		seasonStartDate: '2026-09-01',
		seasonEndDate: '2026-12-01',
		hasPostseason: false,
		postseasonStartDate: null,
		postseasonEndDate: null,
		hasPreseason: false,
		preseasonStartDate: null,
		preseasonEndDate: null,
		isActive: true,
		isLocked: false,
		imageUrl: null,
		...overrides
	};
}

describe('split registration dates', () => {
	it('keeps calendar-only date controls in the requested natural focus order', () => {
		// column-first markup avoids positive tabindex values that would disrupt the rest of the modal.
		const fields = readFileSync('src/lib/components/wizard/LeagueScheduleFields.svelte', 'utf8');
		const splitInput = readFileSync('src/lib/components/DateTimeInput.svelte', 'utf8');
		const markers = ['-reg-start', '-reg-end', '-season-start', '-season-end'];
		const positions = markers.map((marker) => fields.indexOf(marker));
		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((a, b) => a - b));
		expect(splitInput.indexOf('<DatePicker')).toBeLessThan(splitInput.indexOf('<TimeInput'));
		expect(splitInput).toContain('data-wizard-autofocus={autofocus || undefined}');
		expect(fields.match(/<DateTimeInput\s/g)).toHaveLength(4);
		expect(splitInput).not.toContain('datetime-local');
		expect(splitInput).toContain('calendarButtonTabIndex={-1}');
	});
	it('uses the shared schedule fields in all three creation entry points', () => {
		// guard the live routes so helper tests cannot pass while copied ui stays unchanged.
		const root = readFileSync('src/routes/dashboard/offerings/+page.svelte', 'utf8');
		const detail = readFileSync(
			'src/routes/dashboard/offerings/[seasonSlug]/[offeringSlug]/+page.svelte',
			'utf8'
		);
		expect(root.match(/<LeagueScheduleFields\s/g)).toHaveLength(2);
		expect(detail.match(/<LeagueScheduleFields\s/g)).toHaveLength(1);
		for (const route of [root, detail]) {
			expect(route).not.toContain('Season start date must be on or after registration deadline.');
		}
	});
	it('preserves the other part and supports incomplete drafts without inventing dates', () => {
		expect(splitDateTimeValue('2026-08-01T17:30')).toEqual({ date: '2026-08-01', time: '17:30' });
		expect(replaceDateTimePart('2026-08-01T17:30', 'date', '2026-08-02')).toBe('2026-08-02T17:30');
		expect(replaceDateTimePart('2026-08-01T17:30', 'time', '18:45')).toBe('2026-08-01T18:45');
		expect(replaceDateTimePart('', 'date', '2026-08-02', '23:59')).toBe('2026-08-02T23:59');
		expect(replaceDateTimePart('', 'time', '18:45')).toBe('T18:45');
		expect(replaceDateTimePart('2026-08-01T17:30', 'time', '')).toBe('2026-08-01T');
	});
	it('allows registration after season start when creating and updating a league', () => {
		expect(
			createIntramuralLeagueSchema.safeParse({ offeringId: 'offering-1', leagues: [league()] })
				.success
		).toBe(true);
		expect(
			updateIntramuralLeagueSchema.safeParse({
				offeringId: 'offering-1',
				leagueId: 'league-1',
				league: league()
			}).success
		).toBe(true);
	});
	it('accepts season timestamps while keeping legacy date-only league payloads valid', () => {
		// older saved drafts still contain dates only; the new fields must not invalidate them.
		const timed = league({
			seasonStartDate: '2026-09-01T00:00',
			seasonEndDate: '2026-12-01T23:59'
		});
		expect(
			createIntramuralLeagueSchema.safeParse({ offeringId: 'offering-1', leagues: [timed] }).success
		).toBe(true);
		expect(
			createIntramuralLeagueSchema.safeParse({ offeringId: 'offering-1', leagues: [league()] })
				.success
		).toBe(true);
	});
	it('still rejects reversed registration and season ranges', () => {
		expect(
			createIntramuralLeagueSchema.safeParse({
				offeringId: 'offering-1',
				leagues: [league({ regStartDate: '2026-10-01T00:00' })]
			}).success
		).toBe(false);
		expect(
			createIntramuralLeagueSchema.safeParse({
				offeringId: 'offering-1',
				leagues: [league({ seasonEndDate: '2026-08-01' })]
			}).success
		).toBe(false);
	});
});
