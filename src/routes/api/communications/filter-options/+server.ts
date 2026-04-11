import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { loadCommunicationFilterOptions } from '$lib/server/communications';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}

	if (!requirePermission(event.locals, PERMISSIONS.PREVIEW_COMMUNICATION_AUDIENCE)) {
		return json(
			{
				success: false,
				error: 'You do not have permission to load communication recipient filters.'
			},
			{ status: 403 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = getCentralDbOps(event);
	const filterOptions = await loadCommunicationFilterOptions(dbOps, clientId);

	event.locals.requestLogMeta = {
		table: 'seasons,offerings,leagues,divisions,teams',
		recordCount:
			filterOptions.seasons.length +
			filterOptions.offerings.length +
			filterOptions.leagues.length +
			filterOptions.divisions.length +
			filterOptions.teams.length
	};

	return json({
		success: true,
		data: {
			filterOptions
		}
	});
};
