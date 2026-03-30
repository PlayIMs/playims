export type SearchPaletteMovementFocusMode = 'focus-result' | 'preserve-input';

interface ResolveMovementIntentOptions {
	shiftKey?: boolean;
	targetIsInput?: boolean;
	targetIsResult?: boolean;
}

interface SearchPaletteMovementIntent {
	offset: -1 | 1;
	focusMode: SearchPaletteMovementFocusMode;
}

export function resolveSearchPaletteMovementIntent(
	key: string,
	options: ResolveMovementIntentOptions
): SearchPaletteMovementIntent | null {
	if (key === 'ArrowDown') {
		return {
			offset: 1,
			focusMode: 'focus-result'
		};
	}

	if (key === 'ArrowUp') {
		return {
			offset: -1,
			focusMode: 'focus-result'
		};
	}

	if (key !== 'Tab') {
		return null;
	}

	if (options.targetIsInput) {
		return {
			offset: options.shiftKey ? -1 : 1,
			focusMode: 'preserve-input'
		};
	}

	if (options.targetIsResult) {
		return {
			offset: options.shiftKey ? -1 : 1,
			focusMode: 'focus-result'
		};
	}

	return null;
}

export function getNextSearchPaletteHighlightedIndex(
	currentIndex: number,
	totalCount: number,
	offset: -1 | 1
): number {
	if (totalCount <= 0) {
		return -1;
	}

	if (currentIndex < 0) {
		return offset > 0 ? 0 : totalCount - 1;
	}

	const nextIndex = currentIndex + offset;
	if (nextIndex < 0) {
		return totalCount - 1;
	}

	if (nextIndex >= totalCount) {
		return 0;
	}

	return nextIndex;
}
