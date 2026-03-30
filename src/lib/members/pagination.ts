export function resolveClosestMemberPage(
	requestedPage: number,
	totalPages: number
): number {
	const safeTotalPages = Math.max(1, totalPages);
	return Math.max(1, Math.min(requestedPage, safeTotalPages));
}

export function parseMemberPageInput(
	value: string,
	currentPage: number,
	totalPages: number
): number {
	const normalizedValue = value.trim();
	if (!normalizedValue) return resolveClosestMemberPage(currentPage, totalPages);

	const parsedValue = Number(normalizedValue);
	if (!Number.isFinite(parsedValue)) {
		return resolveClosestMemberPage(currentPage, totalPages);
	}

	return resolveClosestMemberPage(Math.trunc(parsedValue), totalPages);
}
