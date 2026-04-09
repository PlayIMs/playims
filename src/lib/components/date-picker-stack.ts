const openDatePickerStack: symbol[] = [];

export function registerOpenDatePicker(datePickerId: symbol): void {
	if (openDatePickerStack.includes(datePickerId)) return;
	openDatePickerStack.push(datePickerId);
}

export function unregisterOpenDatePicker(datePickerId: symbol): void {
	const index = openDatePickerStack.lastIndexOf(datePickerId);
	if (index < 0) return;
	openDatePickerStack.splice(index, 1);
}

export function isTopDatePicker(datePickerId: symbol): boolean {
	return openDatePickerStack[openDatePickerStack.length - 1] === datePickerId;
}

export function hasOpenDatePicker(): boolean {
	return openDatePickerStack.length > 0;
}
