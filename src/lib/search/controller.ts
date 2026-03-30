import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { SearchGroup } from './types.js';

export type SearchPaletteSource = 'keyboard' | 'launcher';

export const searchPaletteOpen = writable(false);
export const searchPaletteQuery = writable('');
export const searchPaletteGroups = writable<SearchGroup[]>([]);
export const searchPaletteTotalCount = writable(0);
export const searchPaletteLoading = writable(false);
export const searchPaletteErrorMessage = writable('');
export const searchPaletteHighlightedIndex = writable(-1);
export const searchPaletteScopedSeasonId = writable('');
export const searchPaletteLoadingSeasonScope = writable(false);
export const searchPaletteSeasons = writable<
	Array<{
		id: string;
		name: string;
		slug: string;
		startDate: string;
		endDate: string | null;
		isCurrent: boolean;
		isActive: boolean;
	}>
>([]);
export const searchPaletteSource = writable<SearchPaletteSource>('keyboard');

let searchPaletteInputElement: HTMLInputElement | null = null;
let pendingSearchPaletteInputFocus = false;
let lastFocusedElement: HTMLElement | null = null;

function focusRegisteredInput(): void {
	if (!browser || !searchPaletteInputElement) return;

	searchPaletteInputElement.focus();
	const valueLength = searchPaletteInputElement.value.length;
	searchPaletteInputElement.setSelectionRange(valueLength, valueLength);
	pendingSearchPaletteInputFocus = false;
}

function resetSearchPaletteSessionState(): void {
	searchPaletteGroups.set([]);
	searchPaletteTotalCount.set(0);
	searchPaletteLoading.set(false);
	searchPaletteErrorMessage.set('');
	searchPaletteHighlightedIndex.set(-1);
	searchPaletteSeasons.set([]);
	searchPaletteScopedSeasonId.set('');
	searchPaletteLoadingSeasonScope.set(false);
}

export function resolveSearchPaletteShortcutHint(platformText: string): 'Cmd + K' | 'Ctrl + K' {
	return /(mac|iphone|ipad|ipod)/.test(platformText.toLowerCase()) ? 'Cmd + K' : 'Ctrl + K';
}

export function registerSearchPaletteInput(element: HTMLInputElement | null): void {
	searchPaletteInputElement = element;
	if (pendingSearchPaletteInputFocus && searchPaletteInputElement) {
		queueMicrotask(() => {
			focusRegisteredInput();
		});
	}
}

export function focusSearchPaletteInput(): void {
	pendingSearchPaletteInputFocus = true;
	queueMicrotask(() => {
		focusRegisteredInput();
	});
}

export function openSearchPalette(source: SearchPaletteSource, initialQuery?: string): void {
	const wasOpen = get(searchPaletteOpen);
	if (!wasOpen) {
		lastFocusedElement =
			browser && document.activeElement instanceof HTMLElement ? document.activeElement : null;
		resetSearchPaletteSessionState();
		searchPaletteOpen.set(true);
	}

	searchPaletteSource.set(source);
	if (typeof initialQuery === 'string') {
		searchPaletteQuery.set(initialQuery);
	}

	focusSearchPaletteInput();
}

export function closeSearchPalette(): void {
	searchPaletteOpen.set(false);
	searchPaletteQuery.set('');
	resetSearchPaletteSessionState();
	pendingSearchPaletteInputFocus = false;
	if (browser) {
		lastFocusedElement?.focus();
	}
}

export function setSearchPaletteQuery(value: string): void {
	searchPaletteQuery.set(value);
}

export function setSearchPaletteGroups(value: SearchGroup[]): void {
	searchPaletteGroups.set(value);
}

export function setSearchPaletteTotalCount(value: number): void {
	searchPaletteTotalCount.set(value);
}

export function setSearchPaletteLoading(value: boolean): void {
	searchPaletteLoading.set(value);
}

export function setSearchPaletteErrorMessage(value: string): void {
	searchPaletteErrorMessage.set(value);
}

export function setSearchPaletteHighlightedIndex(value: number): void {
	searchPaletteHighlightedIndex.set(value);
}

export function clearSearchPaletteHighlightedIndex(): void {
	searchPaletteHighlightedIndex.set(-1);
}

export function setSearchPaletteScopedSeasonId(value: string): void {
	searchPaletteScopedSeasonId.set(value);
}

export function setSearchPaletteLoadingSeasonScope(value: boolean): void {
	searchPaletteLoadingSeasonScope.set(value);
}

export function setSearchPaletteSeasons(
	value: Array<{
		id: string;
		name: string;
		slug: string;
		startDate: string;
		endDate: string | null;
		isCurrent: boolean;
		isActive: boolean;
	}>
): void {
	searchPaletteSeasons.set(value);
}

export function readSearchPaletteControllerState(): {
	open: boolean;
	query: string;
	highlightedIndex: number;
	scopedSeasonId: string;
	source: SearchPaletteSource;
} {
	return {
		open: get(searchPaletteOpen),
		query: get(searchPaletteQuery),
		highlightedIndex: get(searchPaletteHighlightedIndex),
		scopedSeasonId: get(searchPaletteScopedSeasonId),
		source: get(searchPaletteSource)
	};
}

export function resetSearchPaletteControllerState(): void {
	searchPaletteOpen.set(false);
	searchPaletteQuery.set('');
	searchPaletteSource.set('keyboard');
	resetSearchPaletteSessionState();
	searchPaletteInputElement = null;
	pendingSearchPaletteInputFocus = false;
	lastFocusedElement = null;
}
