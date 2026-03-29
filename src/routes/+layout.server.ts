import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import {
	CURRENT_THEME_COOKIE_KEY,
	DEFAULT_THEME,
	parseStoredThemeColors,
	serializeThemeColors,
	STANDALONE_PWA_FALLBACK_PRIMARY
} from '$lib/theme';
import type { LayoutServerLoad } from './$types';

const normalizeHex = (value: string | null | undefined) =>
	(value ?? '').replace('#', '').toUpperCase();

const buildThemeEtag = (
	theme: {
		id?: string | null;
		updatedAt?: string | null;
		primary?: string | null;
		secondary?: string | null;
		neutral?: string | null;
	} | null
) => {
	if (!theme) {
		return 'W/"theme-empty"';
	}

	const parts = [
		theme.id ?? 'no-id',
		theme.updatedAt ?? '',
		theme.primary ?? '',
		theme.secondary ?? '',
		theme.neutral ?? ''
	];

	return `W/"${parts.join('|')}"`;
};

const resolveCookieThemePrimary = (rawCookieValue: string | undefined): string | null => {
	if (!rawCookieValue) {
		return null;
	}

	try {
		const parsed = parseStoredThemeColors(decodeURIComponent(rawCookieValue));
		return parsed?.primary ?? null;
	} catch {
		return null;
	}
};

export const load: LayoutServerLoad = async (event) => {
	const { locals } = event;
	const activeClientId = locals.session?.activeClientId ?? null;
	const cookieThemePrimary = resolveCookieThemePrimary(
		event.cookies.get(CURRENT_THEME_COOKIE_KEY)
	);
	const resolvedCookieThemePrimary = cookieThemePrimary ?? STANDALONE_PWA_FALLBACK_PRIMARY;
	try {
		const centralDbOps = getCentralDbOps(event);
		await ensureDefaultClient(centralDbOps);
		const clientId = resolveClientId(locals);
		const tenantDbOps = await getTenantDbOps(event, clientId);
		const current = await tenantDbOps.themes.getBySlug(clientId, 'current');

		if (!current) {
			return {
				activeClientId,
				pwaChromePrimary: resolvedCookieThemePrimary,
				theme: { ...DEFAULT_THEME },
				themeEtag: buildThemeEtag(null),
				themeSource: 'fallback'
			};
		}

		const resolvedCurrentTheme = {
			primary: normalizeHex(current.primary) || DEFAULT_THEME.primary,
			secondary: normalizeHex(current.secondary) || DEFAULT_THEME.secondary,
			neutral: normalizeHex(current.neutral)
		};
		event.cookies.set(CURRENT_THEME_COOKIE_KEY, serializeThemeColors(resolvedCurrentTheme), {
			path: '/',
			maxAge: 60 * 60 * 24 * 365,
			sameSite: 'lax',
			httpOnly: false
		});

		return {
			activeClientId,
			pwaChromePrimary: resolvedCurrentTheme.primary || DEFAULT_THEME.primary,
			theme: resolvedCurrentTheme,
			themeEtag: buildThemeEtag(current),
			themeSource: 'db'
		};
	} catch (error) {
		console.error('Failed to load theme for layout:', error);
		return {
			activeClientId,
			pwaChromePrimary: resolvedCookieThemePrimary,
			theme: { ...DEFAULT_THEME },
			themeEtag: buildThemeEtag(null),
			themeSource: 'fallback'
		};
	}
};
