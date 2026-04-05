import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import {
	createCommunicationService,
	loadCommunicationFilterOptions
} from '$lib/server/communications';
import { communicationDraftPayloadSchema } from '$lib/server/communications/validation';
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

export const GET: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.VIEW_COMMUNICATION_HISTORY)) {
		return json(
			{ success: false, error: 'You do not have permission to view communications.' },
			{ status: 403 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const messageId = event.params.messageId?.trim();
	if (!messageId) {
		return json({ success: false, error: 'Message ID is required.' }, { status: 400 });
	}

	const dbOps = getCentralDbOps(event);
	const detail = await dbOps.communications.getMessageDetail(clientId, messageId);
	if (!detail) {
		return json({ success: false, error: 'Communication message not found.' }, { status: 404 });
	}

	return json({
		success: true,
		data: detail
	});
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.EDIT_COMMUNICATION_DRAFT, { mutate: true })) {
		return json(
			{ success: false, error: 'You do not have permission to update communications.' },
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = communicationDraftPayloadSchema.safeParse({
		...(typeof body === 'object' && body ? (body as Record<string, unknown>) : {}),
		messageId: event.params.messageId
	});
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
	if (!parsed.data.subject.trim()) {
		return json(
			{
				success: false,
				error: 'Subject is required.',
				fieldErrors: { subject: ['Subject is required.'] }
			},
			{ status: 400 }
		);
	}
	if (parsed.data.recipientGroups.length === 0 && parsed.data.manualRecipients.length === 0) {
		return json(
			{
				success: false,
				error: 'At least one recipient source is required.',
				fieldErrors: {
					recipientGroups: ['Add at least one recipient group or manual recipient before saving.']
				}
			},
			{ status: 400 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = getCentralDbOps(event);
	const filterOptions = await loadCommunicationFilterOptions(dbOps, clientId);
	const service = createCommunicationService(event, dbOps);
	const result = await service.saveDraft({
		clientId,
		userId,
		payload: parsed.data,
		filterOptions
	});

	return json({
		success: true,
		data: {
			messageId: result.id
		}
	});
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.DELETE_COMMUNICATION_DRAFT, { mutate: true })) {
		return json(
			{ success: false, error: 'You do not have permission to delete communications.' },
			{ status: 403 }
		);
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const messageId = event.params.messageId?.trim();
	if (!messageId) {
		return json({ success: false, error: 'Message ID is required.' }, { status: 400 });
	}

	const dbOps = getCentralDbOps(event);
	const service = createCommunicationService(event, dbOps);

	try {
		await service.deleteDraft({
			clientId,
			messageId
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to delete this draft.';
		return json(
			{ success: false, error: message },
			{ status: /not found/i.test(message) ? 404 : 400 }
		);
	}

	return json({
		success: true,
		data: {
			messageId
		}
	});
};
