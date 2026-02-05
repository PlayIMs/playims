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

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const theme = await dbOps.themes.getById(clientId, params.themeId);
		if (!theme) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		return json({ success: true, data: theme });
	} catch (error) {
		console.error('Failed to load theme:', error);
		return json({ success: false, error: 'Failed to load theme' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const userId = locals.user?.id;
		const existing = await dbOps.themes.getById(clientId, params.themeId);
		if (!existing) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		if (existing.slug === 'current') {
			return json({ success: false, error: 'Cannot update current theme here' }, { status: 400 });
		}

		const body = (await request.json()) as Record<string, unknown>;
		const name = typeof body.name === 'string' ? body.name.trim() : (existing.name ?? '');
		if (!name) {
			return json({ success: false, error: 'Theme name is required' }, { status: 400 });
		}
		const colors = getColorsFromBody(body);
		if (!colors) {
			return json({ success: false, error: 'Theme colors are required' }, { status: 400 });
		}

		const updated = await dbOps.themes.update(clientId, existing.id, {
			name,
			primary: colors.primary,
			secondary: colors.secondary,
			neutral: colors.neutral,
			accent: colors.accent,
			updatedAt: new Date().toISOString(),
			updatedUser: userId
		});

		return json({ success: true, data: updated });
	} catch (error) {
		console.error('Failed to update theme:', error);
		return json({ success: false, error: 'Failed to update theme' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const existing = await dbOps.themes.getById(clientId, params.themeId);
		if (!existing) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		if (existing.slug === 'current') {
			return json({ success: false, error: 'Cannot delete current theme' }, { status: 400 });
		}
		const deleted = await dbOps.themes.delete(clientId, existing.id);
		return json({ success: true, data: deleted });
	} catch (error) {
		console.error('Failed to delete theme:', error);
		return json({ success: false, error: 'Failed to delete theme' }, { status: 500 });
	}
};
