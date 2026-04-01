import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import {
	createCommunicationService,
	loadCommunicationFilterOptions
} from '$lib/server/communications';
import { communicationPreviewRequestSchema } from '$lib/server/communications/validation';
import type { RequestHandler } from './$types';

const toFieldErrorMap = (
	issues: Array<{
		path: Array<PropertyKey>;
		message: string;
	}>
): Record<string, string[]> => {
	const fieldErrors: Record<string, string[]> = {};
	for (const issue of issues) {
		const key = issue.path.map((part) => String(part)).join('.');
		if (!fieldErrors[key]) {
			fieldErrors[key] = [];
		}
		fieldErrors[key].push(issue.message);
	}
	return fieldErrors;
};

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.VIEW_COMMUNICATION_CENTER)) {
		return json(
			{ success: false, error: 'You do not have permission to preview communications.' },
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = communicationPreviewRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(parsed.error.issues)
			},
			{ status: 400 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const dbOps = getCentralDbOps(event);
	const filterOptions = await loadCommunicationFilterOptions(dbOps, clientId);
	const service = createCommunicationService(event, dbOps);
	const batches = await Promise.all(
		parsed.data.batches.map((batch) =>
			service.previewBatch({
				clientId,
				batchId: batch.id,
				mode: batch.mode,
				filters: batch.filters,
				filterOptions
			})
		)
	);
	const preview = await service.previewAudience({
		clientId,
		batches: batches.map((entry) => entry.storedBatch)
	});

	event.locals.requestLogMeta = {
		table: 'users,user_clients,rosters,teams,divisions,leagues,offerings,seasons',
		recordCount: preview.totalCount
	};

	return json({
		success: true,
		data: {
			messagePreview: preview,
			batches: batches.map((entry) => entry.storedBatch)
		}
	});
};
