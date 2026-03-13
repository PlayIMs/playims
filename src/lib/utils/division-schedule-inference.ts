export interface DivisionNameInference {
	dayOfWeek: string;
	gameTime: string;
}

export interface DivisionDayOption {
	shortLabel: string;
	value: string;
	aliases: string[];
}

export const DIVISION_DAY_OPTIONS: DivisionDayOption[] = [
	{ shortLabel: 'Mon', value: 'Monday', aliases: ['monday', 'mon', 'm'] },
	{ shortLabel: 'Tue', value: 'Tuesday', aliases: ['tuesday', 'tues', 'tue', 'tu', 't'] },
	{ shortLabel: 'Wed', value: 'Wednesday', aliases: ['wednesday', 'wed', 'w'] },
	{ shortLabel: 'Thu', value: 'Thursday', aliases: ['thursday', 'thurs', 'thur', 'thu', 'th', 'r'] },
	{ shortLabel: 'Fri', value: 'Friday', aliases: ['friday', 'fri', 'f'] },
	{ shortLabel: 'Sat', value: 'Saturday', aliases: ['saturday', 'sat', 'sa'] },
	{ shortLabel: 'Sun', value: 'Sunday', aliases: ['sunday', 'sun', 'su'] }
];

const RANGE_CONNECTOR_PATTERN = /^\s*(?:-|to|through|thru)\s*$/i;
const TIME_SEPARATOR_PATTERN = /\s*(?:\/|,|&|and)\s*/i;
const DAY_INDEX_BY_VALUE = new Map(
	DIVISION_DAY_OPTIONS.map((option, index) => [option.value, index] as const)
);
const DAY_VALUE_BY_ALIAS = new Map(
	DIVISION_DAY_OPTIONS.flatMap((option) =>
		option.aliases.map((alias) => [alias.toLowerCase(), option.value] as const)
	)
);
const DAY_TOKEN_REGEX = new RegExp(
	`\\b(${Array.from(DAY_VALUE_BY_ALIAS.keys())
		.sort((left, right) => right.length - left.length)
		.map(escapeRegex)
		.join('|')})\\b`,
	'gi'
);
const TIME_GROUP_REGEX =
	/\b(?:1[0-2]|0?[1-9])(?::[0-5]\d)?(?:\s*[AaPp]\.?\s*[Mm]\.?)?(?:\s*(?:\/|,|&|and)\s*(?:1[0-2]|0?[1-9])(?::[0-5]\d)?(?:\s*[AaPp]\.?\s*[Mm]\.?)?)*\b/gi;
const TIME_TOKEN_REGEX = /^\s*(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([AaPp])?(?:\.?\s*[Mm]\.?)?\s*$/i;

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueValuesInOrder(values: string[]): string[] {
	const seen = new Set<string>();
	const ordered: string[] = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		ordered.push(value);
	}
	return ordered;
}

function sortDays(values: string[]): string[] {
	return [...values].sort(
		(left, right) => (DAY_INDEX_BY_VALUE.get(left) ?? 999) - (DAY_INDEX_BY_VALUE.get(right) ?? 999)
	);
}

function expandDayRange(startValue: string, endValue: string): string[] {
	const startIndex = DAY_INDEX_BY_VALUE.get(startValue);
	const endIndex = DAY_INDEX_BY_VALUE.get(endValue);
	if (startIndex === undefined || endIndex === undefined) return [startValue, endValue];
	if (startIndex === endIndex) return [startValue];

	if (startIndex < endIndex) {
		return DIVISION_DAY_OPTIONS.slice(startIndex, endIndex + 1).map((option) => option.value);
	}

	return [
		...DIVISION_DAY_OPTIONS.slice(startIndex).map((option) => option.value),
		...DIVISION_DAY_OPTIONS.slice(0, endIndex + 1).map((option) => option.value)
	];
}

function normalizeDayMatch(token: string): string | null {
	return DAY_VALUE_BY_ALIAS.get(token.trim().toLowerCase()) ?? null;
}

function normalizeTimeValue(rawValue: string, fallbackMeridiem?: 'AM' | 'PM'): string | null {
	const match = TIME_TOKEN_REGEX.exec(rawValue);
	if (!match) return null;

	const meridiemValue = match[3]?.toUpperCase();
	const meridiem = meridiemValue === 'A' || meridiemValue === 'P' ? `${meridiemValue}M` : fallbackMeridiem;
	if (!meridiem) return null;

	const hour = String(Number(match[1] ?? ''));
	const minutes = match[2] ?? '00';
	return `${hour}:${minutes} ${meridiem}`;
}

function parseTimeGroup(group: string): string[] {
	const parts = group
		.split(TIME_SEPARATOR_PATTERN)
		.map((value) => value.trim())
		.filter(Boolean);
	if (parts.length === 0) return [];

	const explicitMeridiems = parts
		.map((value) => {
			const match = TIME_TOKEN_REGEX.exec(value);
			if (!match?.[3]) return null;
			return match[3].toUpperCase() === 'A' ? 'AM' : 'PM';
		})
		.filter((value): value is 'AM' | 'PM' => Boolean(value));
	const fallbackMeridiem =
		explicitMeridiems.length === 1 ? explicitMeridiems[0] : explicitMeridiems.at(-1);

	return uniqueValuesInOrder(
		parts
			.map((value) => normalizeTimeValue(value, fallbackMeridiem))
			.filter((value): value is string => Boolean(value))
	);
}

export function parseDivisionDays(value: string): string[] {
	const matches = Array.from(value.matchAll(DAY_TOKEN_REGEX))
		.map((match) => {
			const normalizedValue = normalizeDayMatch(match[0] ?? '');
			if (!normalizedValue || match.index === undefined) return null;
			return {
				value: normalizedValue,
				index: match.index,
				length: match[0].length
			};
		})
		.filter(
			(match): match is { value: string; index: number; length: number } => Boolean(match)
		);

	const parsedDays: string[] = [];
	for (let index = 0; index < matches.length; index += 1) {
		const currentMatch = matches[index];
		const nextMatch = matches[index + 1];

		if (currentMatch && nextMatch) {
			const betweenText = value.slice(
				currentMatch.index + currentMatch.length,
				nextMatch.index
			);
			if (RANGE_CONNECTOR_PATTERN.test(betweenText)) {
				parsedDays.push(...expandDayRange(currentMatch.value, nextMatch.value));
				index += 1;
				continue;
			}
		}

		parsedDays.push(currentMatch.value);
	}

	return uniqueValuesInOrder(parsedDays);
}

export function formatDivisionDays(values: string[]): string {
	const orderedValues = sortDays(uniqueValuesInOrder(values));
	if (orderedValues.length === 0) return '';

	const segments: string[] = [];
	let index = 0;

	while (index < orderedValues.length) {
		const rangeValues = [orderedValues[index]];
		while (index + rangeValues.length < orderedValues.length) {
			const previousValue = rangeValues[rangeValues.length - 1];
			const nextValue = orderedValues[index + rangeValues.length];
			const previousIndex = DAY_INDEX_BY_VALUE.get(previousValue);
			const nextIndex = DAY_INDEX_BY_VALUE.get(nextValue);
			if (previousIndex === undefined || nextIndex === undefined || nextIndex !== previousIndex + 1) {
				break;
			}
			rangeValues.push(nextValue);
		}

		if (rangeValues.length >= 3) {
			segments.push(`${rangeValues[0]}-${rangeValues[rangeValues.length - 1]}`);
		} else {
			segments.push(...rangeValues);
		}

		index += rangeValues.length;
	}

	return segments.join(' / ');
}

export function inferDayOfWeekFromDivisionName(name: string): string {
	return formatDivisionDays(parseDivisionDays(name));
}

export function inferGameTimeFromDivisionName(name: string): string {
	const timeValues = uniqueValuesInOrder(
		Array.from(name.matchAll(TIME_GROUP_REGEX)).flatMap((match) => parseTimeGroup(match[0] ?? ''))
	);
	return timeValues.join(' / ');
}

export function inferDivisionNameDetails(name: string): DivisionNameInference {
	return {
		dayOfWeek: inferDayOfWeekFromDivisionName(name),
		gameTime: inferGameTimeFromDivisionName(name)
	};
}
