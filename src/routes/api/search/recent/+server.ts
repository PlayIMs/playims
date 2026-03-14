import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCentralDbOps } from '$lib/server/database/context';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { storeMegaSearchRecentSelection } from '$lib/server/search/recent.js';
import type { MegaSearchRecentPayload } from '$lib/search/types.js';
import type { RequestHandler } from './$types';

const recentPayloadSchema = z.object({
	resultKey: z.string().trim().min(1),
	category: z.string().trim().min(1),
	title: z.string().trim().min(1),
	subtitle: z.string().trim().nullish(),
	href: z.string().trim().min(1),
	badge: z.string().trim().nullish(),
	meta: z.string().trim().nullish()
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user?.id || !event.locals.session?.activeClientId) {
		return json({ success: false, error: 'Authentication is required.' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = recentPayloadSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const dbOps = getCentralDbOps(event);
	await storeMegaSearchRecentSelection(dbOps, {
		userId: requireAuthenticatedUserId(event.locals),
		clientId: requireAuthenticatedClientId(event.locals),
		payload: parsed.data as MegaSearchRecentPayload
	});

	return json({ success: true });
};
