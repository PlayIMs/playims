import { json } from '@sveltejs/kit';
import { DatabaseOperations } from '$lib/database';
import { ensureDefaultClient, resolveClientId } from '$lib/server/client-context';
import { updateCurrentThemeSchema } from '$lib/server/theme-validation';
import type { RequestHandler } from './$types';

const buildEtag = (
	theme: {
		id?: string | null;
		updatedAt?: string | null;
		primary?: string | null;
		secondary?: string | null;
		neutral?: string | null;
		accent?: string | null;
	} | null
) => {
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
		return json({ success: false, error: 'Failed to load current theme' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const dbOps = new DatabaseOperations(platform as App.Platform);
		await ensureDefaultClient(dbOps);
		const clientId = resolveClientId(locals);
		const userId = locals.user?.id;
		let body: unknown;
		try {
			body = (await request.json()) as unknown;
		} catch {
			return json({ success: false, error: 'Invalid request payload' }, { status: 400 });
		}
		const parsed = updateCurrentThemeSchema.safeParse(body);
		if (!parsed.success) {
			return json({ success: false, error: 'Invalid request payload' }, { status: 400 });
		}
		const colors = parsed.data.colors;

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
		return json({ success: false, error: 'Failed to update current theme' }, { status: 500 });
	}
};
