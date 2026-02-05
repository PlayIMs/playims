import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import { DEFAULT_THEME } from '$lib/theme';
import type { LayoutServerLoad } from './$types';

const normalizeHex = (value: string | null | undefined) =>
	(value ?? '').replace('#', '').toUpperCase();

const buildThemeEtag = (theme: {
	id?: string | null;
	updatedAt?: string | null;
	primary?: string | null;
	secondary?: string | null;
	neutral?: string | null;
	accent?: string | null;
} | null) => {
	if (!theme) {
		return 'W/"theme-empty"';
	}

	const parts = [
		theme.id ?? 'no-id',
		theme.updatedAt ?? '',
		theme.primary ?? '',
		theme.secondary ?? '',
		theme.neutral ?? '',
		theme.accent ?? ''
	];

	return `W/"${parts.join('|')}"`;
};

export const load: LayoutServerLoad = async ({ platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const current = await dbOps.themes.getBySlug(clientId, 'current');

		if (!current) {
			return {
				theme: { ...DEFAULT_THEME },
				themeEtag: buildThemeEtag(null),
				themeSource: 'fallback'
			};
		}

		return {
			theme: {
				primary: normalizeHex(current.primary) || DEFAULT_THEME.primary,
				secondary: normalizeHex(current.secondary) || DEFAULT_THEME.secondary,
				neutral: normalizeHex(current.neutral),
				accent: normalizeHex(current.accent) || DEFAULT_THEME.accent
			},
			themeEtag: buildThemeEtag(current),
			themeSource: 'db'
		};
	} catch (error) {
		console.error('Failed to load theme for layout:', error);
		return {
			theme: { ...DEFAULT_THEME },
			themeEtag: buildThemeEtag(null),
			themeSource: 'fallback'
		};
	}
};
