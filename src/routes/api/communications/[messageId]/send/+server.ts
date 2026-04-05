import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { createCommunicationService } from '$lib/server/communications';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.SEND_COMMUNICATION, { mutate: true })) {
		return json(
			{ success: false, error: 'You do not have permission to send communications.' },
			{ status: 403 }
		);
	}

	const messageId = event.params.messageId?.trim();
	if (!messageId) {
		return json({ success: false, error: 'Message ID is required.' }, { status: 400 });
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = getCentralDbOps(event);
	const service = createCommunicationService(event, dbOps);

	try {
		const detail = await service.sendDraft({
			clientId,
			userId,
			messageId
		});

		return json({
			success: true,
			data: detail
		});
	} catch (error) {
		const message =
			error instanceof Error && error.message.trim().length > 0
				? error.message
				: 'Unable to send the communication email.';
		return json({ success: false, error: message }, { status: 400 });
	}
};
