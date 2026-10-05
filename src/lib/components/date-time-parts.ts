export function splitDateTimeValue(value: string): { date: string; time: string } {
	const [date = '', time = ''] = value.split('T');
	return { date, time: /^\d{2}:\d{2}:\d{2}$/.test(time) ? time.slice(0, 5) : time };
}

export function replaceDateTimePart(
	value: string,
	part: 'date' | 'time',
	next: string,
	defaultTime = '00:00'
): string {
	const current = splitDateTimeValue(value);
	const date = part === 'date' ? next : current.date;
	const time = part === 'time' ? next : current.time || defaultTime;
	return date || time ? `${date}T${time}` : '';
}
