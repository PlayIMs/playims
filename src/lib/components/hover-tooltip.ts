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
