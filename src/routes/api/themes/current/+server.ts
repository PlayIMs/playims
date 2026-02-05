import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import type { RequestHandler } from './$types';

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

export const GET: RequestHandler = async ({ platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const theme = await dbOps.themes.getBySlug(clientId, 'current');
		return json({ success: true, data: theme || null });
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

		return json({ success: true, data: theme });
	} catch (error) {
		console.error('Failed to update current theme:', error);
		return json({ success: false, error: 'Failed to update current theme' }, { status: 500 });
	}
};
