export type CommunicationEditorCommand =
	| 'bold'
	| 'italic'
	| 'underline'
	| 'link'
	| 'bulletList'
	| 'orderedList'
	| 'undo'
	| 'redo';

interface ShortcutEventLike {
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	code: string;
	key: string;
}

interface ShortcutTargetLike {
	tagName?: string | null;
	isContentEditable?: boolean;
	closest?: ((selector: string) => unknown) | null;
}

const isModifierShortcut = (event: ShortcutEventLike): boolean =>
	(event.ctrlKey || event.metaKey) && !event.altKey;

export const resolveCommunicationEditorShortcut = (
	event: ShortcutEventLike
): CommunicationEditorCommand | null => {
	if (!isModifierShortcut(event)) {
		return null;
	}

	if (!event.shiftKey) {
		switch (event.code) {
			case 'KeyB':
				return 'bold';
			case 'KeyI':
				return 'italic';
			case 'KeyU':
				return 'underline';
			case 'KeyK':
				return 'link';
			case 'KeyZ':
				return 'undo';
			case 'KeyY':
				return 'redo';
			default:
				return null;
		}
	}

	switch (event.code) {
		case 'Digit8':
			return 'bulletList';
		case 'Digit7':
			return 'orderedList';
		case 'KeyZ':
			return 'redo';
		default:
			return null;
	}
};

export const isCommunicationEditorEditableTarget = (
	target: ShortcutTargetLike | null | undefined
): boolean => {
	if (!target) {
		return false;
	}

	if (target.isContentEditable) {
		return true;
	}

	const tagName = target.tagName?.toLowerCase() ?? '';
	if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
		return true;
	}

	return Boolean(target.closest?.('[data-communication-editor-root]'));
};
