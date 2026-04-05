export function shouldHideHoverTooltipOnWindowMouseOut(
	relatedTarget: EventTarget | null
): boolean {
	return relatedTarget === null;
}

export function shouldHideHoverTooltipOnVisibilityChange(
	visibilityState: DocumentVisibilityState
): boolean {
	return visibilityState !== 'visible';
}

export function resolveHoverTooltipShortcutKeyLabel(value: string, useMacLabels: boolean): string {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'mod' || normalized === 'cmdorctrl' || normalized === 'ctrl/cmd') {
		return useMacLabels ? 'Cmd' : 'Ctrl';
	}

	if (normalized === 'alt' || normalized === 'option' || normalized === 'opt') {
		return useMacLabels ? 'Opt' : 'Alt';
	}

	return value.trim();
}
