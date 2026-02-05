import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import type { RequestHandler } from './$types';

const MAX_SAVED_THEMES = 15;

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

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

export const GET: RequestHandler = async ({ platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const themes = await dbOps.themes.getSaved(clientId);
		return json({ success: true, data: themes });
	} catch (error) {
		console.error('Failed to load themes:', error);
		return json({ success: false, error: 'Failed to load themes' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const userId = locals.user?.id;
		const body = (await request.json()) as Record<string, unknown>;
		const name = typeof body.name === 'string' ? body.name.trim() : '';

		if (!name) {
			return json({ success: false, error: 'Theme name is required' }, { status: 400 });
		}

		const colors = getColorsFromBody(body);
		if (!colors) {
			return json({ success: false, error: 'Theme colors are required' }, { status: 400 });
		}

		const total = await dbOps.themes.countSaved(clientId);
		if (total >= MAX_SAVED_THEMES) {
			return json({ success: false, error: 'MAX_THEMES' }, { status: 409 });
		}

		let baseSlug = slugify(name);
		if (!baseSlug) {
			baseSlug = `theme-${Date.now()}`;
		}
		if (baseSlug === 'current') {
			baseSlug = 'current-theme';
		}

		let slug = baseSlug;
		let suffix = 1;
		while (await dbOps.themes.getBySlug(clientId, slug)) {
			slug = `${baseSlug}-${suffix}`;
			suffix += 1;
		}

		const theme = await dbOps.themes.create({
			clientId,
			name,
			slug,
			primary: colors.primary,
			secondary: colors.secondary,
			neutral: colors.neutral,
			accent: colors.accent,
			createdUser: userId,
			updatedUser: userId
		});

		return json({ success: true, data: theme });
	} catch (error) {
		console.error('Failed to save theme:', error);
		return json({ success: false, error: 'Failed to save theme' }, { status: 500 });
	}
};
