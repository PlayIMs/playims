import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import type { RequestHandler } from './$types';

const buildEtag = (theme: {
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

const normalizeHex = (hex: string) => hex.replace('#', '').toUpperCase();

const getColorsFromBody = (body: Record<string, unknown>) => {
	const colors = (body.colors as Record<string, string>) || body;
	const primary = typeof colors.primary === 'string' ? normalizeHex(colors.primary) : null;
	const secondary = typeof colors.secondary === 'string' ? normalizeHex(colors.secondary) : null;
	const accent = typeof colors.accent === 'string' ? normalizeHex(colors.accent) : null;
	const neutral = typeof colors.neutral === 'string' ? normalizeHex(colors.neutral) : '';

	if (!primary || !secondary || !accent) {
		return null;
	}

	return { primary, secondary, neutral, accent };
};

export const GET: RequestHandler = async ({ platform, locals, request }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const theme = await dbOps.themes.getBySlug(clientId, 'current');

		const etag = buildEtag(theme);
		const ifNoneMatch = request.headers.get('if-none-match');
		if (ifNoneMatch && ifNoneMatch === etag) {
			return new Response(null, {
				status: 304,
				headers: {
					ETag: etag,
					'Cache-Control': 'no-cache'
				}
			});
		}

		return json(
			{ success: true, data: theme || null },
			{
				headers: {
					ETag: etag,
					'Cache-Control': 'no-cache'
				}
			}
		);
	} catch (error) {
		console.error('Failed to load current theme:', error);
		return json({ success: false, error: 'Failed to load current theme' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const userId = locals.user?.id;
		const body = (await request.json()) as Record<string, unknown>;
		const colors = getColorsFromBody(body);

		if (!colors) {
			return json({ success: false, error: 'Theme colors are required' }, { status: 400 });
		}

		const theme = await dbOps.themes.upsertCurrent({
			clientId,
			primary: colors.primary,
			secondary: colors.secondary,
			neutral: colors.neutral,
			accent: colors.accent,
			userId
		});

		const etag = buildEtag(theme);

		return json(
			{ success: true, data: theme },
			{
				headers: {
					ETag: etag
				}
			}
		);
	} catch (error) {
		console.error('Failed to update current theme:', error);
		return json({ success: false, error: 'Failed to update current theme' }, { status: 500 });
	}
};
