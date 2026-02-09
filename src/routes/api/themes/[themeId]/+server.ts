import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import { themeIdParamSchema, updateSavedThemeSchema } from '$lib/server/theme-validation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	try {
		const parsedParams = themeIdParamSchema.safeParse(params);
		if (!parsedParams.success) {
			return json({ success: false, error: 'Invalid theme id' }, { status: 400 });
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const theme = await dbOps.themes.getById(clientId, parsedParams.data.themeId);
		if (!theme) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		return json({ success: true, data: theme });
	} catch (error) {
		return json({ success: false, error: 'Failed to load theme' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
	try {
		const parsedParams = themeIdParamSchema.safeParse(params);
		if (!parsedParams.success) {
			return json({ success: false, error: 'Invalid theme id' }, { status: 400 });
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const userId = locals.user?.id;
		const existing = await dbOps.themes.getById(clientId, parsedParams.data.themeId);
		if (!existing) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		if (existing.slug === 'current') {
			return json({ success: false, error: 'Cannot update current theme here' }, { status: 400 });
		}

		let body: unknown;
		try {
			body = (await request.json()) as unknown;
		} catch {
			return json({ success: false, error: 'Invalid request payload' }, { status: 400 });
		}
		const parsed = updateSavedThemeSchema.safeParse(body);
		if (!parsed.success) {
			return json({ success: false, error: 'Invalid request payload' }, { status: 400 });
		}
		const name = parsed.data.name;
		const colors = parsed.data.colors;

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
		return json({ success: false, error: 'Failed to update theme' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	try {
		const parsedParams = themeIdParamSchema.safeParse(params);
		if (!parsedParams.success) {
			return json({ success: false, error: 'Invalid theme id' }, { status: 400 });
		}

		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const existing = await dbOps.themes.getById(clientId, parsedParams.data.themeId);
		if (!existing) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		if (existing.slug === 'current') {
			return json({ success: false, error: 'Cannot delete current theme' }, { status: 400 });
		}
		const deleted = await dbOps.themes.delete(clientId, existing.id);
		return json({ success: true, data: deleted });
	} catch (error) {
		return json({ success: false, error: 'Failed to delete theme' }, { status: 500 });
	}
};
