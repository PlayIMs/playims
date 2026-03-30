import { json } from '@sveltejs/kit';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import {
	CURRENT_THEME_COOKIE_KEY,
	DEFAULT_THEME,
	parseStoredThemeColors,
	STANDALONE_PWA_FALLBACK_PRIMARY
} from '$lib/theme';
import type { RequestHandler } from './$types';

const normalizeHex = (value: string | null | undefined): string | null => {
	const normalized = (value ?? '').replace('#', '').toUpperCase();
	return /^[0-9A-F]{6}$/.test(normalized) ? normalized : null;
};

const resolveCookieThemeColor = (cookieTheme: string | undefined): string | null => {
	if (cookieTheme) {
		try {
			const parsed = parseStoredThemeColors(decodeURIComponent(cookieTheme));
			const cookiePrimary = normalizeHex(parsed?.primary);
			if (cookiePrimary) {
				return cookiePrimary;
			}
		} catch {
			// ignore malformed cookies and fall through to the shared fallback
		}
	}

	return null;
};

const resolveDatabaseThemeColor = async (
	event: Parameters<RequestHandler>[0]
): Promise<string | null> => {
	try {
		const centralDbOps = getCentralDbOps(event);
		await ensureDefaultClient(centralDbOps);
		const clientId = resolveClientId(event.locals);
		const tenantDbOps = await getTenantDbOps(event, clientId);
		const currentTheme = await tenantDbOps.themes.getBySlug(clientId, 'current');
		return normalizeHex(currentTheme?.primary);
	} catch {
		return null;
	}
};

export const GET: RequestHandler = async (event) => {
	const themeColor =
		(await resolveDatabaseThemeColor(event)) ??
		resolveCookieThemeColor(event.cookies.get(CURRENT_THEME_COOKIE_KEY)) ??
		normalizeHex(STANDALONE_PWA_FALLBACK_PRIMARY) ??
		DEFAULT_THEME.primary;

	event.setHeaders({
		'cache-control': 'no-store, max-age=0',
		'content-type': 'application/manifest+json; charset=utf-8'
	});

	return json({
		name: 'PlayIMs',
		short_name: 'PlayIMs',
		description:
			'Modern intramural sports league management platform with intuitive team management, automated scheduling, and real-time standings.',
		id: '/',
		start_url: '/dashboard',
		display: 'standalone',
		display_override: ['window-controls-overlay'],
		background_color: '#EEDBCE',
		theme_color: `#${themeColor}`,
		orientation: 'portrait-primary',
		scope: '/',
		lang: 'en-US',
		categories: ['sports', 'productivity', 'utilities'],
		icons: [
			{
				src: '/pwa-64x64.png',
				sizes: '64x64',
				type: 'image/png'
			},
			{
				src: '/pwa-192x192.png',
				sizes: '192x192',
				type: 'image/png'
			},
			{
				src: '/pwa-512x512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: '/maskable-icon-512x512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		],
		screenshots: [
			{
				src: '/pwa-512x512.png',
				sizes: '512x512',
				type: 'image/png',
				form_factor: 'narrow'
			},
			{
				src: '/pwa-512x512.png',
				sizes: '512x512',
				type: 'image/png',
				form_factor: 'wide'
			}
		],
		related_applications: [],
		prefer_related_applications: false
	});
};
