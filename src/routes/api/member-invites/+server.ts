import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import type { PendingInviteListResponse } from '$lib/members/types.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json(
			{ success: false, error: 'Database is unavailable.' } satisfies PendingInviteListResponse,
			{ status: 500 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = getCentralDbOps(event);
	const rows = await dbOps.members.listPendingInvites(clientId);

	event.locals.requestLogMeta = {
		table: 'member_invites',
		recordCount: rows.length
	};

	return json({
		success: true,
		data: {
			rows,
			pageSize: rows.length
		}
	} satisfies PendingInviteListResponse);
};
