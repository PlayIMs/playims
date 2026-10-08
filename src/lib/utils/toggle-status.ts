export function getToggleStatus(
	checked: boolean,
	onLabel = 'Enabled',
	offLabel = 'Disabled'
): string {
	return checked ? onLabel : offLabel;
}

export function getSeasonToggleStatus(
	isCurrent: boolean,
	startDate: string,
	referenceDate = new Date()
): string {
	if (isCurrent) return 'Current';
	const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(startDate);
	if (!match) return 'Not Current';
	const [, year, month, day] = match.map(Number);
	const start = new Date(year, month - 1, day);
	if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
		return 'Not Current';
	}
	const today = new Date(
		referenceDate.getFullYear(),
		referenceDate.getMonth(),
		referenceDate.getDate()
	);
	return start > today ? 'Future' : 'Past';
}
