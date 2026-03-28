import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import type { MegaSearchGroup } from './types.js';

export type MegaSearchPaletteSource = 'keyboard' | 'launcher';

export const megaSearchOpen = writable(false);
export const megaSearchQuery = writable('');
export const megaSearchGroups = writable<MegaSearchGroup[]>([]);
export const megaSearchTotalCount = writable(0);
export const megaSearchLoading = writable(false);
export const megaSearchErrorMessage = writable('');
export const megaSearchHighlightedIndex = writable(-1);
export const megaSearchScopedSeasonId = writable('');
export const megaSearchLoadingSeasonScope = writable(false);
export const megaSearchSeasons = writable<
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
export const megaSearchSource = writable<MegaSearchPaletteSource>('keyboard');

let megaSearchInputElement: HTMLInputElement | null = null;
let pendingMegaSearchInputFocus = false;
let lastFocusedElement: HTMLElement | null = null;

function focusRegisteredInput(): void {
	if (!browser || !megaSearchInputElement) return;

	megaSearchInputElement.focus();
	const valueLength = megaSearchInputElement.value.length;
	megaSearchInputElement.setSelectionRange(valueLength, valueLength);
	pendingMegaSearchInputFocus = false;
}

function resetMegaSearchSessionState(): void {
	megaSearchGroups.set([]);
	megaSearchTotalCount.set(0);
	megaSearchLoading.set(false);
	megaSearchErrorMessage.set('');
	megaSearchHighlightedIndex.set(-1);
	megaSearchSeasons.set([]);
	megaSearchScopedSeasonId.set('');
	megaSearchLoadingSeasonScope.set(false);
}

export function resolveMegaSearchShortcutHint(platformText: string): 'Cmd + K' | 'Ctrl + K' {
	return /(mac|iphone|ipad|ipod)/.test(platformText.toLowerCase()) ? 'Cmd + K' : 'Ctrl + K';
}

export function registerMegaSearchInput(element: HTMLInputElement | null): void {
	megaSearchInputElement = element;
	if (pendingMegaSearchInputFocus && megaSearchInputElement) {
		queueMicrotask(() => {
			focusRegisteredInput();
		});
	}
}

export function focusMegaSearchPaletteInput(): void {
	pendingMegaSearchInputFocus = true;
	queueMicrotask(() => {
		focusRegisteredInput();
	});
}

export function openMegaSearchPalette(
	source: MegaSearchPaletteSource,
	initialQuery?: string
): void {
	const wasOpen = get(megaSearchOpen);
	if (!wasOpen) {
		lastFocusedElement =
			browser && document.activeElement instanceof HTMLElement ? document.activeElement : null;
		resetMegaSearchSessionState();
		megaSearchOpen.set(true);
	}

	megaSearchSource.set(source);
	if (typeof initialQuery === 'string') {
		megaSearchQuery.set(initialQuery);
	}

	focusMegaSearchPaletteInput();
}

export function closeMegaSearchPalette(): void {
	megaSearchOpen.set(false);
	megaSearchQuery.set('');
	resetMegaSearchSessionState();
	pendingMegaSearchInputFocus = false;
	if (browser) {
		lastFocusedElement?.focus();
	}
}

export function setMegaSearchQuery(value: string): void {
	megaSearchQuery.set(value);
}

export function setMegaSearchGroups(value: MegaSearchGroup[]): void {
	megaSearchGroups.set(value);
}

export function setMegaSearchTotalCount(value: number): void {
	megaSearchTotalCount.set(value);
}

export function setMegaSearchLoading(value: boolean): void {
	megaSearchLoading.set(value);
}

export function setMegaSearchErrorMessage(value: string): void {
	megaSearchErrorMessage.set(value);
}

export function setMegaSearchHighlightedIndex(value: number): void {
	megaSearchHighlightedIndex.set(value);
}

export function clearMegaSearchHighlightedIndex(): void {
	megaSearchHighlightedIndex.set(-1);
}

export function setMegaSearchScopedSeasonId(value: string): void {
	megaSearchScopedSeasonId.set(value);
}

export function setMegaSearchLoadingSeasonScope(value: boolean): void {
	megaSearchLoadingSeasonScope.set(value);
}

export function setMegaSearchSeasons(
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
	megaSearchSeasons.set(value);
}

export function readMegaSearchControllerState(): {
	open: boolean;
	query: string;
	highlightedIndex: number;
	scopedSeasonId: string;
	source: MegaSearchPaletteSource;
} {
	return {
		open: get(megaSearchOpen),
		query: get(megaSearchQuery),
		highlightedIndex: get(megaSearchHighlightedIndex),
		scopedSeasonId: get(megaSearchScopedSeasonId),
		source: get(megaSearchSource)
	};
}

export function resetMegaSearchControllerState(): void {
	megaSearchOpen.set(false);
	megaSearchQuery.set('');
	megaSearchSource.set('keyboard');
	resetMegaSearchSessionState();
	megaSearchInputElement = null;
	pendingMegaSearchInputFocus = false;
	lastFocusedElement = null;
}
