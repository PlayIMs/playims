export interface FloatingPositionResult {
	left: number;
	top: number;
	maxWidth: number;
}

interface ViewportBounds {
	left: number;
	right: number;
	top: number;
	bottom: number;
	width: number;
	height: number;
}

interface ViewportConstraintOptions {
	viewportWidth: number;
	viewportHeight: number;
	paddingPx: number;
}

export interface CursorFloatingPositionOptions extends ViewportConstraintOptions {
	cursorX: number;
	cursorY: number;
	panelWidth: number;
	panelHeight: number;
	offsetX: number;
	offsetY: number;
}

export interface AnchoredFloatingPositionOptions extends ViewportConstraintOptions {
	anchorRect: DOMRect;
	panelWidth: number;
	panelHeight: number;
	gapPx: number;
	align: 'left' | 'right';
	preferVertical: 'top' | 'bottom';
}

export function clamp(value: number, min: number, max: number): number {
	if (max < min) return min;
	return Math.min(Math.max(value, min), max);
}

function viewportBounds({
	viewportWidth,
	viewportHeight,
	paddingPx
}: ViewportConstraintOptions): ViewportBounds {
	const left = paddingPx;
	const right = Math.max(left, viewportWidth - paddingPx);
	const top = paddingPx;
	const bottom = Math.max(top, viewportHeight - paddingPx);
	return {
		left,
		right,
		top,
		bottom,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top)
	};
}

export function resolveCursorFloatingPosition(
	options: CursorFloatingPositionOptions
): FloatingPositionResult {
	const bounds = viewportBounds(options);
	const panelWidth = Math.min(options.panelWidth, bounds.width);

	let left = options.cursorX + options.offsetX;
	if (left + panelWidth > bounds.right) {
		left = options.cursorX - options.offsetX - panelWidth;
	}
	left = clamp(left, bounds.left, bounds.right - panelWidth);

	let top = options.cursorY + options.offsetY;
	if (top + options.panelHeight > bounds.bottom) {
		top = options.cursorY - options.offsetY - options.panelHeight;
	}
	top = clamp(top, bounds.top, bounds.bottom - options.panelHeight);

	return { left, top, maxWidth: bounds.width };
}

export function resolveAnchoredFloatingPosition(
	options: AnchoredFloatingPositionOptions
): FloatingPositionResult {
	const bounds = viewportBounds(options);
	const panelWidth = Math.min(options.panelWidth, bounds.width);

	const preferredLeft =
		options.align === 'right'
			? options.anchorRect.right - panelWidth
			: options.anchorRect.left;
	const left = clamp(preferredLeft, bounds.left, bounds.right - panelWidth);

	const belowTop = options.anchorRect.bottom + options.gapPx;
	const aboveTop = options.anchorRect.top - options.gapPx - options.panelHeight;
	const fitsBelow = belowTop + options.panelHeight <= bounds.bottom;
	const fitsAbove = aboveTop >= bounds.top;

	let top = belowTop;
	if (options.preferVertical === 'top') {
		top = fitsAbove || !fitsBelow ? aboveTop : belowTop;
	} else {
		top = fitsBelow || !fitsAbove ? belowTop : aboveTop;
	}
	top = clamp(top, bounds.top, bounds.bottom - options.panelHeight);

	return { left, top, maxWidth: bounds.width };
}

export function toFixedStyle(position: FloatingPositionResult, extra?: string): string {
	const base = `position: fixed; left: ${Math.round(position.left)}px; top: ${Math.round(position.top)}px; visibility: visible;`;
	if (!extra || extra.trim().length === 0) return base;
	return `${base} ${extra}`;
}
