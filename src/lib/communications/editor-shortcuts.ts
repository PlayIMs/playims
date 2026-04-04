interface ShortcutTargetLike {
	tagName?: string | null;
	isContentEditable?: boolean;
	closest?: ((selector: string) => unknown) | null;
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
