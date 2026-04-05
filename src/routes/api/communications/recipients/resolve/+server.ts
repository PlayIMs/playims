import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { createCommunicationService } from '$lib/server/communications';
import { communicationManualRecipientResolveRequestSchema } from '$lib/server/communications/validation';
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
	if (!requirePermission(event.locals, PERMISSIONS.PREVIEW_COMMUNICATION_AUDIENCE, { mutate: true })) {
		return json(
			{ success: false, error: 'You do not have permission to resolve communication recipients.' },
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = communicationManualRecipientResolveRequestSchema.safeParse(body);
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
	const service = createCommunicationService(event, dbOps);

	try {
		const result = await service.searchManualRecipientMatches({
			clientId,
			query: parsed.data.queries[0] ?? ''
		});

		event.locals.requestLogMeta = {
			table: 'users,user_clients,rosters,teams,divisions,leagues,offerings,seasons',
			recordCount:
				result.status === 'resolved'
					? 1
					: result.status === 'ambiguous'
						? result.suggestions.length
						: 0
		};

		if (result.status === 'not_found') {
			return json(
				{
					success: false,
					error: result.message
				},
				{ status: 400 }
			);
		}

		return json({
			success: true,
			data: {
				status: result.status,
				query: result.query,
				manualRecipients: result.status === 'resolved' ? [result.manualRecipient] : [],
				suggestions: result.status === 'ambiguous' ? result.suggestions : []
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				error:
					error instanceof Error && error.message.trim().length > 0
						? error.message
						: 'Unable to resolve manual recipients.'
			},
			{ status: 400 }
		);
	}
};
