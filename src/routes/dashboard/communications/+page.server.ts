import { error } from '@sveltejs/kit';
import { createEmptyCommunicationFilterOptions } from '$lib/communications/types.js';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	const canViewCommunicationCenter = requirePermission(
		locals,
		PERMISSIONS.VIEW_COMMUNICATION_CENTER
	);
	const canViewCommunicationHistory = requirePermission(
		locals,
		PERMISSIONS.VIEW_COMMUNICATION_HISTORY
	);

	if (!canViewCommunicationCenter) {
		throw error(403, 'You do not have permission to access the communication center.');
	}

	if (!event.platform?.env?.DB) {
		return {
			messages: [],
			filterOptions: createEmptyCommunicationFilterOptions(),
			filterOptionsLoaded: false,
			selectedMessage: null
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = getCentralDbOps(event);
	const selectedMessageId = url.searchParams.get('messageId')?.trim() || null;
	const [messages, selectedMessage] = await Promise.all([
		canViewCommunicationHistory
			? dbOps.communications.listMessageSummaries(clientId, 40)
			: Promise.resolve([]),
		canViewCommunicationHistory && selectedMessageId
			? dbOps.communications.getMessageDetail(clientId, selectedMessageId)
			: null
	]);

	locals.requestLogMeta = {
		table:
			'communication_messages,communication_message_batches,communication_message_recipients,users',
		recordCount: messages.length
	};

	return {
		messages,
		filterOptions: createEmptyCommunicationFilterOptions(),
		filterOptionsLoaded: false,
		selectedMessage
	};
};
