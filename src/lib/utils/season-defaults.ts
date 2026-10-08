export function getUpcomingSeasonName(referenceDate = new Date()): string {
	const month = referenceDate.getMonth();
	const year = referenceDate.getFullYear();
	if (month >= 9) return `Spring ${year + 1}`;
	if (month <= 1) return `Spring ${year}`;
	return `Fall ${year}`;
}
