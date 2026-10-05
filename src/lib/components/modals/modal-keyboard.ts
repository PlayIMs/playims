export function getModalTabTarget(
	count: number,
	activeIndex: number,
	shiftKey: boolean
): number | null {
	if (count === 0) return -1;
	if (activeIndex < 0) return shiftKey ? count - 1 : 0;
	if (shiftKey && activeIndex === 0) return count - 1;
	if (!shiftKey && activeIndex === count - 1) return 0;
	return null;
}

export function shouldCloseModalOnEscape(
	key: string,
	defaultPrevented: boolean,
	hasOpenPicker: boolean
): boolean {
	return key === 'Escape' && !defaultPrevented && !hasOpenPicker;
}
