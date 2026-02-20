import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import { themeIdParamSchema, updateSavedThemeSchema } from '$lib/server/theme-validation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	try {
		const { params, locals } = event;
		const parsedParams = themeIdParamSchema.safeParse(params);
		if (!parsedParams.success) {
			return json({ success: false, error: 'Invalid theme id' }, { status: 400 });
		}

		const clientId = requireAuthenticatedClientId(locals);
		const dbOps = await getTenantDbOps(event, clientId);
		const theme = await dbOps.themes.getById(clientId, parsedParams.data.themeId);
		if (!theme) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		return json({ success: true, data: theme });
	} catch {
		return json({ success: false, error: 'Failed to load theme' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		const { params, request, locals } = event;
		const parsedParams = themeIdParamSchema.safeParse(params);
		if (!parsedParams.success) {
			return json({ success: false, error: 'Invalid theme id' }, { status: 400 });
		}

		const clientId = requireAuthenticatedClientId(locals);
		const userId = requireAuthenticatedUserId(locals);
		const dbOps = await getTenantDbOps(event, clientId);
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
	} catch {
		return json({ success: false, error: 'Failed to update theme' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const { params, locals } = event;
		const parsedParams = themeIdParamSchema.safeParse(params);
		if (!parsedParams.success) {
			return json({ success: false, error: 'Invalid theme id' }, { status: 400 });
		}

		const clientId = requireAuthenticatedClientId(locals);
		const dbOps = await getTenantDbOps(event, clientId);
		const existing = await dbOps.themes.getById(clientId, parsedParams.data.themeId);
		if (!existing) {
			return json({ success: false, error: 'Theme not found' }, { status: 404 });
		}
		if (existing.slug === 'current') {
			return json({ success: false, error: 'Cannot delete current theme' }, { status: 400 });
		}
		const deleted = await dbOps.themes.delete(clientId, existing.id);
		return json({ success: true, data: deleted });
	} catch {
		return json({ success: false, error: 'Failed to delete theme' }, { status: 500 });
	}
};
