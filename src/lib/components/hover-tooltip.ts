export interface HoverTooltipRowInput {
	text: string;
	shortcutKeys?: string[];
}

export interface HoverTooltipShortcutKey {
	label: string;
	visualLabel: string;
	rotationDegrees?: number;
}

export interface HoverTooltipRow {
	text: string;
	shortcutKeys: HoverTooltipShortcutKey[];
}

export const HEAVY_ROUND_TIPPED_RIGHT_ARROW = '\u279C';

export function shouldHideHoverTooltipOnWindowMouseOut(relatedTarget: EventTarget | null): boolean {
	return relatedTarget === null;
}

export function shouldHideHoverTooltipOnVisibilityChange(
	visibilityState: DocumentVisibilityState
): boolean {
	return visibilityState !== 'visible';
}

function buildShortcutKey(label: string): HoverTooltipShortcutKey {
	return {
		label,
		visualLabel: label
	};
}

function buildArrowShortcutKey(
	label: 'Left Arrow' | 'Right Arrow' | 'Up Arrow' | 'Down Arrow',
	rotationDegrees: number
): HoverTooltipShortcutKey {
	return {
		label,
		visualLabel: HEAVY_ROUND_TIPPED_RIGHT_ARROW,
		rotationDegrees
	};
}

export function resolveHoverTooltipShortcutKeyLabel(
	value: string,
	useMacLabels: boolean
): HoverTooltipShortcutKey {
	const normalized = value.trim().toLowerCase();
	if (normalized === 'arrowleft' || normalized === 'left arrow') {
		return buildArrowShortcutKey('Left Arrow', 180);
	}

	if (normalized === 'arrowright' || normalized === 'right arrow') {
		return buildArrowShortcutKey('Right Arrow', 0);
	}

	if (normalized === 'arrowup' || normalized === 'up arrow') {
		return buildArrowShortcutKey('Up Arrow', -90);
	}

	if (normalized === 'arrowdown' || normalized === 'down arrow') {
		return buildArrowShortcutKey('Down Arrow', 90);
	}

	if (normalized === 'mod' || normalized === 'cmdorctrl' || normalized === 'ctrl/cmd') {
		return buildShortcutKey(useMacLabels ? 'Cmd' : 'Ctrl');
	}

	if (normalized === 'alt' || normalized === 'option' || normalized === 'opt') {
		return buildShortcutKey(useMacLabels ? 'Opt' : 'Alt');
	}

	return buildShortcutKey(value.trim());
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
				.filter((key) => key.label.length > 0)
		}))
		.filter((row) => row.text.length > 0 || row.shortcutKeys.length > 0);
}
