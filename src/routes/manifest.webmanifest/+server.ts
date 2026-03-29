import { json } from '@sveltejs/kit';
import {
	CURRENT_THEME_COOKIE_KEY,
	parseStoredThemeColors,
	STANDALONE_PWA_FALLBACK_PRIMARY
} from '$lib/theme';
import type { RequestHandler } from './$types';

const normalizeHex = (value: string | null | undefined): string | null => {
	const normalized = (value ?? '').replace('#', '').toUpperCase();
	return /^[0-9A-F]{6}$/.test(normalized) ? normalized : null;
};

const resolveThemeColor = (urlTheme: string | null, cookieTheme: string | undefined): string => {
	const queryTheme = normalizeHex(urlTheme);
	if (queryTheme) {
		return queryTheme;
	}

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

	return STANDALONE_PWA_FALLBACK_PRIMARY;
};

export const GET: RequestHandler = async ({ url, cookies, setHeaders }) => {
	const themeColor = resolveThemeColor(
		url.searchParams.get('theme'),
		cookies.get(CURRENT_THEME_COOKIE_KEY)
	);

	setHeaders({
		'cache-control': 'no-store, max-age=0',
		'content-type': 'application/manifest+json; charset=utf-8'
	});

	return json({
		name: 'PlayIMs',
		short_name: 'PlayIMs',
		description:
			'Modern intramural sports league management platform with intuitive team management, automated scheduling, and real-time standings.',
		id: '/',
		start_url: '/',
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
