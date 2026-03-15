export type ModalDragRect = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

export type ModalDragInsets = {
	top: number;
	right: number;
	bottom: number;
	left: number;
};

export function clampModalTranslate(options: {
	nextX: number;
	nextY: number;
	currentX: number;
	currentY: number;
	panelRect: ModalDragRect;
	boundsRect: ModalDragRect;
	insets: ModalDragInsets;
	topClearance?: number;
}): { x: number; y: number } {
	const minLeft = options.boundsRect.left + options.insets.left;
	const maxRight = options.boundsRect.right - options.insets.right;
	const minTop = options.boundsRect.top + options.insets.top + (options.topClearance ?? 0);
	const maxBottom = options.boundsRect.bottom - options.insets.bottom;

	let deltaX = options.nextX - options.currentX;
	let deltaY = options.nextY - options.currentY;
	const projectedLeft = options.panelRect.left + deltaX;
	let projectedRight = options.panelRect.right + deltaX;
	const projectedTop = options.panelRect.top + deltaY;
	let projectedBottom = options.panelRect.bottom + deltaY;

	if (projectedLeft < minLeft) {
		deltaX += minLeft - projectedLeft;
		projectedRight = options.panelRect.right + deltaX;
	}
	if (projectedRight > maxRight) {
		deltaX -= projectedRight - maxRight;
	}
	if (projectedTop < minTop) {
		deltaY += minTop - projectedTop;
		projectedBottom = options.panelRect.bottom + deltaY;
	}
	if (projectedBottom > maxBottom) {
		deltaY -= projectedBottom - maxBottom;
	}

	return {
		x: options.currentX + deltaX,
		y: options.currentY + deltaY
	};
}
