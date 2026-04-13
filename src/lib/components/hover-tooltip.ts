export interface HoverTooltipRowInput {
	text: string;
	shortcutKeys?: string[];
}

export interface HoverTooltipRow {
	text: string;
	shortcutKeys: string[];
}

export function shouldHideHoverTooltipOnWindowMouseOut(relatedTarget: EventTarget | null): boolean {
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

export function normalizeHoverTooltipRows(
	rows: HoverTooltipRowInput[],
	useMacLabels: boolean
): HoverTooltipRow[] {
	return rows
		.map((row) => ({
			text: String(row.text ?? '').trim(),
			shortcutKeys: (row.shortcutKeys ?? [])
				.map((key) => resolveHoverTooltipShortcutKeyLabel(String(key ?? ''), useMacLabels))
				.filter((key) => key.length > 0)
		}))
		.filter((row) => row.text.length > 0 || row.shortcutKeys.length > 0);
}
