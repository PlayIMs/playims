interface ShortcutTargetLike {
	tagName?: string | null;
	isContentEditable?: boolean;
	closest?: ((selector: string) => unknown) | null;
}

interface ShortcutKeyLike {
	key?: string | null;
	altKey?: boolean;
	shiftKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	repeat?: boolean;
}

export const isCommunicationEditorEditableTarget = (
	target: EventTarget | ShortcutTargetLike | null | undefined
): boolean => {
	if (!target) {
		return false;
	}

	const shortcutTarget = target as ShortcutTargetLike;

	if (shortcutTarget.isContentEditable) {
		return true;
	}

	const tagName = shortcutTarget.tagName?.toLowerCase() ?? '';
	if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
		return true;
	}

	return Boolean(shortcutTarget.closest?.('[data-communication-editor-root]'));
};

export const isCommunicationEditorSpecialCharacterShortcut = (
	event: KeyboardEvent | ShortcutKeyLike | null | undefined
): boolean => {
	if (!event || event.repeat) {
		return false;
	}

	return (
		String(event.key ?? '').toLowerCase() === 's' &&
		(event.altKey ?? false) &&
		(event.shiftKey ?? false) &&
		!(event.ctrlKey ?? false) &&
		!(event.metaKey ?? false)
	);
};
