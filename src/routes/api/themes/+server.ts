import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getTenantDbOps } from '$lib/server/database/context';
import { createSavedThemeSchema } from '$lib/server/theme-validation';
import type { RequestHandler } from './$types';

const MAX_SAVED_THEMES = 15;

const slugify = (value: string) =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

export const GET: RequestHandler = async (event) => {
	try {
		const { locals } = event;
		const clientId = requireAuthenticatedClientId(locals);
		const dbOps = await getTenantDbOps(event, clientId);
		const themes = await dbOps.themes.getSaved(clientId);
		return json({ success: true, data: themes });
	} catch {
		return json({ success: false, error: 'Failed to load themes' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const { request, locals } = event;
		const clientId = requireAuthenticatedClientId(locals);
		const userId = requireAuthenticatedUserId(locals);
		const dbOps = await getTenantDbOps(event, clientId);
		let body: unknown;
		try {
			body = (await request.json()) as unknown;
		} catch {
			return json({ success: false, error: 'Invalid request payload' }, { status: 400 });
		}
		const parsed = createSavedThemeSchema.safeParse(body);
		if (!parsed.success) {
			return json({ success: false, error: 'Invalid request payload' }, { status: 400 });
		}

		const total = await dbOps.themes.countSaved(clientId);
		if (total >= MAX_SAVED_THEMES) {
			return json({ success: false, error: 'MAX_THEMES' }, { status: 409 });
		}

		const name = parsed.data.name;
		const colors = parsed.data.colors;

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
	} catch {
		return json({ success: false, error: 'Failed to save theme' }, { status: 500 });
	}
};
