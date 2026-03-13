export const STANDALONE_DISPLAY_MODE_QUERY = '(display-mode: standalone)';
export const SVELTEKIT_HISTORY_INDEX_KEY = 'sveltekit:history';
const MAX_STORED_PWA_HISTORY_ENTRIES = 100;

export type StandaloneDisplayModeProbe = {
	matchMedia?: ((query: string) => { matches: boolean } | null | undefined) | null;
	navigatorStandalone?: boolean | null;
};

export function isStandaloneDisplayMode(probe: StandaloneDisplayModeProbe): boolean {
	if (probe.navigatorStandalone === true) {
		return true;
	}

	if (!probe.matchMedia) {
		return false;
	}

	try {
		return probe.matchMedia(STANDALONE_DISPLAY_MODE_QUERY)?.matches === true;
	} catch {
		return false;
	}
}

export function readSvelteKitHistoryIndex(state: unknown): number | null {
	if (!state || typeof state !== 'object') {
		return null;
	}

	const value = (state as Record<string, unknown>)[SVELTEKIT_HISTORY_INDEX_KEY];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export type PwaHistoryMenuDirection = 'back' | 'forward';

export type PwaHistoryEntry = {
	index: number;
	route: string;
	label: string;
	title: string;
};

export function buildPwaHistoryRoute(url: URL): string {
	const route = `${url.pathname}${url.search}${url.hash}`;
	return route || '/';
}

function normalizePwaHistoryTitle(title: string | null | undefined, route: string): string {
	const trimmedTitle = title?.trim();
	return trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : route;
}

export function buildPwaHistoryEntry(
	url: URL,
	currentIndex: number,
	title?: string | null
): PwaHistoryEntry {
	const route = buildPwaHistoryRoute(url);
	return {
		index: currentIndex,
		route,
		label: route,
		title: normalizePwaHistoryTitle(title, route)
	};
}

export function parseStoredPwaHistoryEntries(value: string | null): PwaHistoryEntry[] {
	if (!value) {
		return [];
	}

	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.filter((entry): entry is PwaHistoryEntry => {
				return (
					typeof entry === 'object' &&
					entry !== null &&
					typeof (entry as Record<string, unknown>).index === 'number' &&
					Number.isFinite((entry as Record<string, unknown>).index) &&
					typeof (entry as Record<string, unknown>).route === 'string' &&
					typeof (entry as Record<string, unknown>).label === 'string' &&
					typeof (entry as Record<string, unknown>).title === 'string'
				);
			})
			.sort((left, right) => left.index - right.index);
	} catch {
		return [];
	}
}

export function serializePwaHistoryEntries(entries: PwaHistoryEntry[]): string {
	return JSON.stringify(entries);
}

export function syncPwaHistoryEntries(options: {
	entries: PwaHistoryEntry[];
	currentIndex: number;
	url: URL;
	title?: string | null;
	navigationType?: string | null;
}): PwaHistoryEntry[] {
	const nextEntry = buildPwaHistoryEntry(options.url, options.currentIndex, options.title);
	let nextEntries = options.entries
		.filter((entry) => entry.index !== options.currentIndex)
		.filter((entry) =>
			options.navigationType === 'popstate' ? true : entry.index < options.currentIndex
		);

	nextEntries.push(nextEntry);
	nextEntries.sort((left, right) => left.index - right.index);

	if (nextEntries.length > MAX_STORED_PWA_HISTORY_ENTRIES) {
		nextEntries = nextEntries.slice(nextEntries.length - MAX_STORED_PWA_HISTORY_ENTRIES);
	}

	return nextEntries;
}

export function selectPwaHistoryMenuEntries(options: {
	entries: PwaHistoryEntry[];
	currentIndex: number;
	direction: PwaHistoryMenuDirection;
	limit?: number;
}): PwaHistoryEntry[] {
	const limit = Math.max(1, options.limit ?? 10);
	const matchingEntries = options.entries.filter((entry) =>
		options.direction === 'back'
			? entry.index < options.currentIndex
			: entry.index > options.currentIndex
	);

	const sortedEntries = matchingEntries.sort((left, right) =>
		options.direction === 'back' ? right.index - left.index : left.index - right.index
	);

	return sortedEntries.slice(0, limit);
}

export function truncatePwaHistoryRoute(route: string): string {
	const trimmedRoute = route.trim();
	if (!trimmedRoute || trimmedRoute === '/') {
		return '/';
	}

	const queryOrHashIndex = trimmedRoute.search(/[?#]/);
	const pathOnly =
		queryOrHashIndex >= 0 ? trimmedRoute.slice(0, queryOrHashIndex) : trimmedRoute;
	const suffix = queryOrHashIndex >= 0 ? trimmedRoute.slice(queryOrHashIndex) : '';
	const segments = pathOnly.split('/').filter((segment) => segment.length > 0);

	if (segments.length <= 4) {
		return `${pathOnly || '/'}${suffix}`;
	}

	const leadingSegments = segments.slice(0, 2).join('/');
	const trailingSegments = segments.slice(-2).join('/');
	return `/${leadingSegments}/.../${trailingSegments}${suffix}`;
}

export function buildPwaAddressValue(url: URL): string {
	return `${url.host}${url.pathname}${url.search}${url.hash}`;
}

export function shouldSyncPwaAddressValue(options: {
	isEditing: boolean;
	navigationInFlight: boolean;
}): boolean {
	return !options.isEditing && !options.navigationInFlight;
}

export function resolvePwaAddressInput(input: string, currentUrl: URL): URL | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed === currentUrl.host || trimmed.startsWith(`${currentUrl.host}/`)) {
		return new URL(`${currentUrl.protocol}//${trimmed}`);
	}

	if (
		trimmed.startsWith('/') ||
		trimmed.startsWith('?') ||
		trimmed.startsWith('#') ||
		trimmed.startsWith('.')
	) {
		return new URL(trimmed, currentUrl);
	}

	try {
		return new URL(trimmed);
	} catch {
		// keep falling through to app-friendly shortcuts
	}

	if (!trimmed.includes(' ') && trimmed.includes('.')) {
		try {
			return new URL(`https://${trimmed}`);
		} catch {
			// keep falling through to final same-origin path handling
		}
	}

	if (!trimmed.includes(' ')) {
		return new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, currentUrl.origin);
	}

	try {
		return new URL(trimmed, currentUrl);
	} catch {
		return null;
	}
}

export type PwaAddressNavigationTarget = {
	href: string;
	route: string | null;
};

export function resolvePwaAddressNavigationTarget(
	input: string,
	currentUrl: URL
): PwaAddressNavigationTarget | null {
	const targetUrl = resolvePwaAddressInput(input, currentUrl);
	if (!targetUrl) {
		return null;
	}

	return {
		href: targetUrl.href,
		route:
			targetUrl.origin === currentUrl.origin
				? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
				: null
	};
}
