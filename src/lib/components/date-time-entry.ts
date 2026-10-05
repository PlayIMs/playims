export function timeSegmentEdit(
	value: string,
	start: number,
	end: number,
	key: string
): { value: string; start: number; end: number } | null {
	const suffix = /[ap]m?$/i.exec(value);
	if (/^[ap]$/i.test(key)) {
		if (suffix && start >= value.length && end === start) return null;
		const clock = value.replace(/\s*[ap]m?$/i, '');
		if (!clock || !completeTimeEntry(clock + key, '00:00')) return null;
		const next = clock + ` ${key.toUpperCase()}M`;
		return { value: next, start: next.length, end: next.length };
	}
	if (!/^\d$/.test(key) || (suffix && start >= suffix.index)) return null;
	const raw = value.slice(0, start) + key + value.slice(end);
	const match = /^(\d{1,2})(?::(\d{0,2}))?(?:\s*([ap])m?)?$/i.exec(raw);
	if (!match) return null;
	const hour = Number(match[1]);
	if (
		hour > (match[3] ? 12 : 23) ||
		(match[1].length === 2 && match[3] && hour === 0) ||
		Number(match[2] ?? 0) > 59
	)
		return null;
	const caret = start + 1;
	const colon = raw.indexOf(':');
	if ((colon < 0 || caret <= colon) && match[1].length === 2) {
		const hourText = String(hour);
		const minutes = match[2] ?? '';
		const next = `${hourText}:${minutes}${match[3] ? ` ${match[3].toUpperCase()}M` : ''}`;
		return { value: next, start: hourText.length + 1, end: hourText.length + 1 + minutes.length };
	}
	if (colon >= 0 && caret > colon && match[2]?.length === 2) {
		const next = `${match[1]}:${match[2]} ${match[3]?.toUpperCase() ?? 'A'}M`;
		return { value: next, start: next.length - 2, end: next.length };
	}
	return { value: raw, start: caret, end: caret };
}

export function dateDigitEdit(
	value: string,
	start: number,
	end: number,
	digit: string
): { value: string; start: number; end: number } {
	// At an existing separator, replace the next segment instead of overflowing into it.
	if (
		start === end &&
		value[start] === '/' &&
		start - (value.lastIndexOf('/', start - 1) + 1) >= 2
	) {
		start = end = start + 1;
	}
	if (start === end && start > 0 && value[start - 1] === '/') {
		const nextSlash = value.indexOf('/', start);
		end = nextSlash < 0 ? value.length : nextSlash;
	}
	const raw = value.slice(0, start) + digit + value.slice(end);
	const repaired = repairDateSegment(raw, start + digit.length);
	const formatted = formatDateEntry(repaired.value);
	const caret = maskedCaret(repaired.value, repaired.caret, formatted);
	const segmentStart = formatted.lastIndexOf('/', caret - 1) + 1;
	if (formatted[caret] === '/' && caret - segmentStart === 2) {
		const nextStart = caret + 1;
		const nextSlash = formatted.indexOf('/', nextStart);
		return {
			value: formatted,
			start: nextStart,
			end: nextSlash < 0 ? formatted.length : nextSlash
		};
	}
	return { value: formatted, start: caret, end: caret };
}

export function timeSelectionRange(
	value: string,
	caret: number,
	direction: -1 | 0 | 1 = 0
): { start: number; end: number } | null {
	const ranges = Array.from(value.matchAll(/\d+|[ap]m?/gi), (match) => ({
		start: match.index,
		end: match.index + match[0].length
	}));
	if (!ranges.length) return null;
	let index = ranges.findIndex((range) => caret <= range.end);
	if (index < 0) index = ranges.length - 1;
	return ranges[Math.max(0, Math.min(ranges.length - 1, index + direction))];
}

export function completeDateEntry(value: string): string {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
	return match ? `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}` : value;
}

export function formatDateEntry(value: string): string {
	const clean = value.replace(/[^\d/]/g, '').replace(/\/{2,}/g, '/');
	if (clean.includes('/')) {
		const parts = clean.split('/');
		let month = parts[0].slice(0, 2);
		if (parts.length === 2 && parts[1] === '') month = month.padStart(2, '0');
		let day = parts[1] ?? '';
		let year = parts[2] ?? '';
		if (day.length > 2) {
			year = day.slice(2) + year;
			day = day.slice(0, 2);
		}
		if (parts.length > 2 && clean.endsWith('/') && day.length === 1) day = day.padStart(2, '0');
		return `${month}/${day}${parts.length > 2 || year ? `/${year.slice(0, 4)}` : ''}`;
	}
	const digits = clean.slice(0, 8);
	return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

export function dateSeparatorEdit(
	value: string,
	start: number,
	end: number
): { value: string; caret: number } | null {
	if (start !== end) return start > 0 && value[start - 1] === '/' ? { value, caret: start } : null;
	const segmentStart = value.lastIndexOf('/', start - 1) + 1;
	if (value.slice(0, segmentStart).split('/').length > 2) return null;
	const segment = value.slice(segmentStart, start);
	if (!/^\d{1,2}$/.test(segment)) return null;
	const padded = segment.padStart(2, '0');
	const rest = value.slice(start).replace(/^\//, '');
	return {
		value: value.slice(0, segmentStart) + padded + '/' + rest,
		caret: segmentStart + padded.length + 1
	};
}

export function isTimeEntryAllowed(value: string): boolean {
	const match = /^(\d{0,4})(?::(\d{0,2}))?(?:\s*([ap])m?)?$/i.exec(value);
	if (!match) return false;
	const digits = match[1];
	if (match[3] && !digits) return false;
	if (match[2] !== undefined) {
		return (
			digits.length <= 2 &&
			Number(digits) <= (match[3] ? 12 : 23) &&
			(!match[3] || Number(digits) >= 1) &&
			Number(match[2]) <= 59
		);
	}
	if (digits.length <= 2) {
		const hour = Number(digits);
		return (
			hour <= (match[3] ? 12 : 23) || (!match[3] && digits.length === 2 && Number(digits[1]) <= 5)
		);
	}
	const hour = Number(digits.slice(0, -2));
	return hour <= (match[3] ? 12 : 23) && (!match[3] || hour >= 1) && Number(digits.slice(-2)) <= 59;
}

export function repairDateSegment(value: string, caret: number): { value: string; caret: number } {
	const parts = value.split('/');
	let offset = 0;
	for (let i = 0; i < Math.min(parts.length, 2); i++) {
		const part = parts[i];
		const limit = i === 0 ? 12 : 31;
		if (
			caret > offset &&
			caret <= offset + part.length &&
			part.length === 2 &&
			Number(part) > limit
		) {
			parts[i] = part.slice(-1);
			return { value: parts.join('/'), caret: caret - 1 };
		}
		offset += part.length + 1;
	}
	return { value, caret };
}

export function formatTimeEntry(value: string): string {
	value = value.replace(/[^\d:apm\s]/gi, '');
	const separated = /^(\d{1,2}):(\d{0,2})(?:\s*([ap])m?)?$/i.exec(value.trim());
	if (separated) {
		return (
			`${separated[1]}:${separated[2]}` +
			(separated[3] ? ` ${separated[3].toUpperCase()}${/m$/i.test(value.trim()) ? 'M' : ''}` : '')
		);
	}
	const match = /^(\d{0,4})(?:\s*([ap])m?)?$/i.exec(value.replace(':', '').trim());
	if (!match) return value;
	const digits = match[1];
	const split = digits.length === 3 ? 1 : 2;
	const clock = digits.length > 2 ? `${digits.slice(0, split)}:${digits.slice(split)}` : digits;
	return (
		clock + (match[2] ? ` ${match[2].toUpperCase()}${/m$/i.test(value.trim()) ? 'M' : ''}` : '')
	);
}

export function completeTimeEntry(value: string, defaultTime: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return defaultTime;
	const match = /^(\d{1,4})(?::(\d{0,2}))?\s*([ap])?m?$/i.exec(trimmed);
	if (!match) return null;
	let hours = match[1];
	let minutes = match[2] ?? '00';
	if (match[2] === undefined && hours.length > 2) {
		minutes = hours.slice(-2);
		hours = hours.slice(0, -2);
	} else if (Number(hours) > 23 && hours.length === 2 && minutes.length === 1) {
		// A three-digit compact entry may acquire a separator while typing (630 -> 63:0).
		minutes = hours[1] + minutes;
		hours = hours[0];
	}
	return parseTimeEntry(
		`${hours}:${(minutes || '00').padStart(2, '0')}${match[3] ? ` ${match[3]}m` : ''}`
	);
}

export function entryHint(value: string, kind: 'date' | 'time'): string {
	if (kind === 'date') {
		if (!/^[\d/]*$/.test(value)) return '';
		const parts = value.split('/');
		const templates = ['MM', 'DD', 'YYYY'];
		const index = parts.length - 1;
		if (index > 2) return '';
		return (
			templates[index].slice(parts[index].length) +
			(index < 2 ? '/' + templates.slice(index + 1).join('/') : '')
		);
	}
	if (!value) return 'HH:MM AM';
	const match = /^(\d{0,2})(?::(\d{0,2}))?(?:\s*([ap])?(m)?)?$/i.exec(value);
	if (!match) return '';
	if (match[3]) return match[4] ? '' : 'M';
	if (match[2] !== undefined) return 'M'.repeat(2 - match[2].length) + ' AM';
	return 'H'.repeat(2 - match[1].length) + ':MM AM';
}

export function separatorAdvance(
	value: string,
	start: number,
	end: number,
	separator: string
): number | null {
	if (start !== end) return null;
	if (value[start] === separator) return start + 1;
	if (start > 0 && value[start - 1] === separator) return start;
	return null;
}

export function guardEntryKey(event: KeyboardEvent, kind: 'date' | 'time'): void {
	if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
	const allowed = kind === 'date' ? /^[\d/]$/ : /^[\d:apm\s]$/i;
	if (!allowed.test(event.key)) {
		event.preventDefault();
		return;
	}
	const separator = kind === 'date' ? '/' : ':';
	const input = event.currentTarget as HTMLInputElement;
	if (kind === 'time' && event.key !== separator) {
		const start = input.selectionStart ?? 0;
		const end = input.selectionEnd ?? start;
		const candidate = input.value.slice(0, start) + event.key + input.value.slice(end);
		if (!isTimeEntryAllowed(candidate)) event.preventDefault();
	}
	if (event.key !== separator) return;
	const next = separatorAdvance(
		input.value,
		input.selectionStart ?? 0,
		input.selectionEnd ?? 0,
		separator
	);
	if (next !== null) {
		event.preventDefault();
		input.setSelectionRange(next, next);
	} else if (kind === 'time') {
		const start = input.selectionStart ?? 0;
		const end = input.selectionEnd ?? start;
		if (!isTimeEntryAllowed(input.value.slice(0, start) + event.key + input.value.slice(end))) {
			event.preventDefault();
		}
	}
}

export function parseTimeEntry(value: string): string | null {
	const formatted = formatTimeEntry(value);
	const match = /^(\d{1,2}):(\d{2})(?:\s*([AP])M?)?$/i.exec(formatted);
	if (!match) return null;
	let hour = Number(match[1]);
	const minute = Number(match[2]);
	if (minute > 59 || hour > 23 || (match[3] && (hour < 1 || hour > 12))) return null;
	if (match[3]) hour = (hour % 12) + (match[3].toUpperCase() === 'P' ? 12 : 0);
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function displayTime(value: string): string {
	if (!/^\d{2}:\d{2}$/.test(value) || !parseTimeEntry(value)) return value;
	const [hour, minute] = value.split(':').map(Number);
	return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

// Count meaningful characters instead of separators to preserve the caret as a mask grows.
export function maskedCaret(raw: string, caret: number, formatted: string): number {
	if (caret === raw.length && /[/:]$/.test(raw)) return formatted.length;
	const count = raw.slice(0, caret).replace(/[^\daApPmM]/g, '').length;
	let seen = 0;
	for (let i = 0; i < formatted.length; i++) {
		if (/[\daApPmM]/.test(formatted[i])) seen++;
		if (seen === count) return i + 1;
	}
	return formatted.length;
}
