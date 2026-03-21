export interface SaveShortcutLikeEvent {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	defaultPrevented?: boolean;
}

export function isSaveShortcutEvent(event: SaveShortcutLikeEvent): boolean {
	if (event.defaultPrevented) return false;
	if (event.altKey || event.shiftKey) return false;
	if (!(event.ctrlKey || event.metaKey)) return false;
	return event.key.toLowerCase() === 's';
}
