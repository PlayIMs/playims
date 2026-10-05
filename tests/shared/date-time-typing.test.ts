/*
Brief description:
This file verifies compact keyboard entry for shared date and time controls.

Deeper explanation:
Input masks add separators without treating an invalid entry as a different valid date or time.
The canonical values remain suitable for server validation and existing database columns.

Summary of tests:
1. It verifies compact dates, partial edits, and impossible calendar dates.
2. It verifies compact times, meridiem conversion, and invalid hours or minutes.
3. It verifies that the live date picker does not overwrite unfinished edits.
4. It verifies shorthand completion, empty-field defaults, and the remaining visual mask.
5. It verifies that valid segment edits are preserved while impossible segments restart.
6. It verifies explicit separator padding and rejects malformed time extensions.
7. It verifies click selection and arrow navigation between time segments.
8. It verifies that replacing a populated date keeps digits in their intended segments.
9. It verifies time segment completion and suppresses errors during active editing.
*/
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	formatDateEntry,
	formatTimeEntry,
	parseTimeEntry,
	displayTime,
	completeTimeEntry,
	entryHint,
	separatorAdvance,
	maskedCaret,
	repairDateSegment,
	dateSeparatorEdit,
	isTimeEntryAllowed,
	timeSelectionRange,
	dateDigitEdit,
	timeSegmentEdit,
	completeDateEntry
} from '../../src/lib/components/date-time-entry';
import { parseDisplayPickerValue } from '../../src/lib/components/date-picker';

describe('manual date and time entry', () => {
	it('advances time segments and completes a selected meridiem from one letter', () => {
		let edit = { value: '11:59 AM', start: 0, end: 2 };
		for (const key of '1204p') edit = timeSegmentEdit(edit.value, edit.start, edit.end, key)!;
		expect(edit).toEqual({ value: '12:04 PM', start: 8, end: 8 });
		let morning = { value: '12:00 PM', start: 0, end: 2 };
		for (const key of '0430a')
			morning = timeSegmentEdit(morning.value, morning.start, morning.end, key)!;
		expect(morning.value).toBe('4:30 AM');
		expect(timeSegmentEdit('12:00 AM', 8, 8, 'a')).toBeNull();
		expect(timeSegmentEdit('1:00 AM', 1, 1, 'p')?.value).toBe('1:00 PM');
		expect(timeSegmentEdit('12:00 AM', 3, 5, '6')?.value).toBe('12:6 AM');
		expect(timeSegmentEdit('12:6 AM', 4, 4, '9')).toBeNull();
		// a rejected month pair must leave the caret in the repaired month, not in the year.
		let date = { value: '10/26/2026', start: 0, end: 2 };
		for (const key of '55') date = dateDigitEdit(date.value, date.start, date.end, key);
		expect(date).toEqual({ value: '5/26/2026', start: 1, end: 1 });
		expect(parseDisplayPickerValue(completeDateEntry(date.value), 'date')).toBe('2026-05-26');
		expect(completeDateEntry('5/6/2026')).toBe('05/06/2026');
		expect(parseDisplayPickerValue(completeDateEntry('5/32/2026'), 'date')).toBeNull();
		const picker = readFileSync('src/lib/components/DatePicker.svelte', 'utf8');
		const time = readFileSync('src/lib/components/TimeInput.svelte', 'utf8');
		expect(picker).toContain('!editing &&');
		expect(time).toContain('!editing &&');
	});
	it('replaces an existing date without carrying old day digits into the year', () => {
		// model the actual selected month followed by continuous keyboard entry.
		let edit = { value: '10/03/2026', start: 0, end: 2 };
		for (const digit of '12231999') edit = dateDigitEdit(edit.value, edit.start, edit.end, digit);
		expect(edit.value).toBe('12/23/1999');
		// a manually typed slash after automatic advancement must not replace the selected day.
		expect(dateSeparatorEdit('12/03/2026', 3, 5)).toEqual({ value: '12/03/2026', caret: 3 });
		const picker = readFileSync('src/lib/components/DatePicker.svelte', 'utf8');
		expect(picker).toContain('const edit = dateDigitEdit(');
		expect(dateDigitEdit('12/03/2026', 3, 5, '2')).toEqual({
			value: '12/2/2026',
			start: 4,
			end: 4
		});
		expect(dateDigitEdit('12/03/2026', 2, 2, '2')).toEqual({
			value: '12/2/2026',
			start: 4,
			end: 4
		});
		let empty = { value: '', start: 0, end: 0 };
		for (const digit of '12231999')
			empty = dateDigitEdit(empty.value, empty.start, empty.end, digit);
		expect(empty.value).toBe('12/23/1999');
	});
	it('selects whole time segments and moves between them without wrapping', () => {
		// punctuation belongs to the preceding segment, matching the date control.
		expect(timeSelectionRange('1:30 PM', 0)).toEqual({ start: 0, end: 1 });
		expect(timeSelectionRange('1:30 PM', 1)).toEqual({ start: 0, end: 1 });
		expect(timeSelectionRange('1:30 PM', 3)).toEqual({ start: 2, end: 4 });
		expect(timeSelectionRange('1:30 PM', 7)).toEqual({ start: 5, end: 7 });
		expect(timeSelectionRange('12:30 AM', 0, 1)).toEqual({ start: 3, end: 5 });
		expect(timeSelectionRange('12:30 AM', 3, 1)).toEqual({ start: 6, end: 8 });
		expect(timeSelectionRange('12:30 AM', 6, -1)).toEqual({ start: 3, end: 5 });
		expect(timeSelectionRange('12:30 AM', 0, -1)).toEqual({ start: 0, end: 2 });
		expect(timeSelectionRange('12:30 AM', 6, 1)).toEqual({ start: 6, end: 8 });
		expect(timeSelectionRange('', 0)).toBeNull();
		expect(timeSelectionRange('1', 0, 1)).toEqual({ start: 0, end: 1 });
		// the shared component must use the tested helper for both pointer and keyboard input.
		const input = readFileSync('src/lib/components/TimeInput.svelte', 'utf8');
		expect(input).toContain('timeSelectionRange(');
		expect(input).toContain('onmouseup=');
		expect(input).toContain('onkeydown={handleKeydown}');
	});
	it('pads completed segments and hides hints for a complete date', () => {
		// a slash completes the segment, even when a separator already follows it.
		expect(dateSeparatorEdit('9/13/1999', 1, 1)).toEqual({ value: '09/13/1999', caret: 3 });
		expect(dateSeparatorEdit('09/3/1999', 4, 4)).toEqual({ value: '09/03/1999', caret: 6 });
		expect(dateSeparatorEdit('9', 1, 1)).toEqual({ value: '09/', caret: 3 });
		expect(entryHint('9/13/1999', 'date')).toBe('');
		expect(entryHint('09/3/1999', 'date')).toBe('');
		expect(displayTime('01:00')).toBe('1:00 AM');
	});
	it('accepts useful partial times but rejects extra suffixes and impossible values', () => {
		for (const value of ['1', '12', '630', '18:30', '1p', '1:00 AM', '1:00 PM']) {
			expect(isTimeEntryAllowed(value)).toBe(true);
		}
		// invalid insertions must be rejected before they replace the current valid draft.
		for (const value of ['12:00 AMAA', '12:00 AMP', '12:00 AM1', '29', '12:69', '13:00 PM']) {
			expect(isTimeEntryAllowed(value)).toBe(false);
		}
	});
	it('preserves valid segment edits and replaces digits only for impossible segments', () => {
		// an existing slash does not mean a newly typed month is ready to be padded or committed.
		expect(formatDateEntry('1/03/2026')).toBe('1/03/2026');
		expect(formatDateEntry('12/03/2026')).toBe('12/03/2026');
		expect(formatDateEntry('12/2/2026')).toBe('12/2/2026');
		expect(repairDateSegment('12/03/2026', 2)).toEqual({ value: '12/03/2026', caret: 2 });
		expect(repairDateSegment('54/03/2026', 2)).toEqual({ value: '4/03/2026', caret: 1 });
		expect(repairDateSegment('12/32/2026', 5)).toEqual({ value: '12/2/2026', caret: 4 });
	});
	it('completes shorthand and restores the appropriate default only on blur', () => {
		expect(completeTimeEntry('12', '00:00')).toBe('12:00');
		expect(completeTimeEntry('1', '00:00')).toBe('01:00');
		expect(completeTimeEntry('1p', '00:00')).toBe('13:00');
		expect(completeTimeEntry('6:3p', '00:00')).toBe('18:03');
		expect(completeTimeEntry('630pm', '00:00')).toBe('18:30');
		expect(completeTimeEntry('', '23:59')).toBe('23:59');
		expect(completeTimeEntry('', '00:00')).toBe('00:00');
		expect(completeTimeEntry('29', '00:00')).toBeNull();
	});
	it('keeps unfilled mask segments visible and skips existing separators', () => {
		expect(entryHint('', 'date')).toBe('MM/DD/YYYY');
		expect(entryHint('12', 'date')).toBe('/DD/YYYY');
		expect(entryHint('12/2', 'date')).toBe('D/YYYY');
		expect(entryHint('12/23/19', 'date')).toBe('YY');
		expect(entryHint('', 'time')).toBe('HH:MM AM');
		expect(entryHint('12', 'time')).toBe(':MM AM');
		expect(entryHint('12:3', 'time')).toBe('M AM');
		expect(separatorAdvance('12/23/1999', 2, 2, '/')).toBe(3);
		expect(separatorAdvance('12:30 PM', 2, 2, ':')).toBe(3);
		expect(separatorAdvance('12:30 PM', 0, 2, ':')).toBeNull();
		// padding a one-digit segment must leave the cursor after the separator, not inside it.
		expect(maskedCaret('1/', 2, '01/')).toBe(3);
		expect(maskedCaret('01/2/', 5, '01/02/')).toBe(6);
	});
	it('keeps live draft edits out of the external-value synchronization dependency', () => {
		// watching draft text caused the effect to restore the old value after every keystroke.
		const picker = readFileSync('src/lib/components/DatePicker.svelte', 'utf8');
		expect(picker).toContain('displayValue === untrack(() => draftValue)');
		expect(picker).toContain('formatDateEntry(raw)');
		expect(picker).toContain('value = nextValue');
	});
	it('adds date separators while retaining partial and invalid input for correction', () => {
		expect(formatDateEntry('12231999')).toBe('12/23/1999');
		expect(formatDateEntry('122')).toBe('12/2');
		// typing must keep accepting digits after the mask inserts its first slash.
		expect(formatDateEntry('12/234')).toBe('12/23/4');
		expect(formatDateEntry('1/')).toBe('01/');
		expect(formatDateEntry('01/2/')).toBe('01/02/');
		expect(formatDateEntry('12x/23z/1999')).toBe('12/23/1999');
		expect(parseDisplayPickerValue(formatDateEntry('43322026'), 'date')).toBeNull();
		// checking the actual calendar prevents february overflow from silently becoming march.
		expect(parseDisplayPickerValue(formatDateEntry('02292025'), 'date')).toBeNull();
		expect(parseDisplayPickerValue(formatDateEntry('02292024'), 'date')).toBe('2024-02-29');
	});
	it('formats compact times and rejects impossible values without clamping them', () => {
		expect(formatTimeEntry('1159pm')).toBe('11:59 PM');
		// a typed p must not insert an extra m before the user types their own m.
		expect(formatTimeEntry('11:59p')).toBe('11:59 P');
		expect(parseTimeEntry('1159p')).toBe('23:59');
		expect(parseTimeEntry('1159pm')).toBe('23:59');
		expect(parseTimeEntry('1200am')).toBe('00:00');
		expect(parseTimeEntry('1830')).toBe('18:30');
		expect(parseTimeEntry('6:30pm')).toBe('18:30');
		expect(parseTimeEntry('2969')).toBeNull();
		expect(parseTimeEntry('1269pm')).toBeNull();
		expect(parseTimeEntry('1300pm')).toBeNull();
		expect(displayTime('00:00')).toBe('12:00 AM');
		expect(displayTime('23:59')).toBe('11:59 PM');
	});
});
