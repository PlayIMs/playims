import { json } from '@sveltejs/kit';
import { requireAuthenticatedClientId, requireAuthenticatedUserId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}
	if (!requirePermission(event.locals, PERMISSIONS.VIEW_COMMUNICATION_CENTER, { mutate: true })) {
		return json(
			{ success: false, error: 'You do not have permission to duplicate communications.' },
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
	const duplicated = await dbOps.communications.duplicateMessage({
		clientId,
		messageId,
		createdUser: userId,
		updatedUser: userId
	});

	if (!duplicated) {
		return json({ success: false, error: 'Communication message not found.' }, { status: 404 });
	}

	return json({
		success: true,
		data: {
			messageId: duplicated.id
		}
	});
};
