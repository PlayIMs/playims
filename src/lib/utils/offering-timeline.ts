export interface OfferingTimelineInput {
	seasonEnd: string | null;
	hasPostseason?: boolean | null;
	postseasonEnd: string | null;
}

function parseTimelineDate(value: string | null): Date | null {
	if (!value) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getEffectiveOfferingEndDate(input: OfferingTimelineInput): string | null {
	if (input.hasPostseason && input.postseasonEnd) {
		return input.postseasonEnd;
	}
	return input.seasonEnd;
}

export function isOfferingTimelineConcluded(
	input: OfferingTimelineInput,
	now: Date = new Date()
): boolean {
	const effectiveEndDate = getEffectiveOfferingEndDate(input);
	const effectiveEnd = parseTimelineDate(effectiveEndDate);
	if (!effectiveEnd) return false;
	return effectiveEnd.getTime() < now.getTime();
}

export function getEffectiveOfferingEndMs(
	input: OfferingTimelineInput,
	fallback = Number.NEGATIVE_INFINITY
): number {
	const effectiveEndDate = getEffectiveOfferingEndDate(input);
	const effectiveEnd = parseTimelineDate(effectiveEndDate);
	return effectiveEnd?.getTime() ?? fallback;
}
