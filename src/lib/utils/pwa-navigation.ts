export const STANDALONE_DISPLAY_MODE_QUERY = '(display-mode: standalone)';
export const SVELTEKIT_HISTORY_INDEX_KEY = 'sveltekit:history';

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

export function buildPwaAddressValue(url: URL): string {
	return `${url.host}${url.pathname}${url.search}${url.hash}`;
}

export function resolvePwaAddressInput(input: string, currentUrl: URL): URL | null {
	const trimmed = input.trim();
	if (!trimmed) {
		return null;
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
