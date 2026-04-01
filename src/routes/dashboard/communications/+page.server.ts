import { error } from '@sveltejs/kit';
import { getCentralDbOps } from '$lib/server/database/context';
import { PERMISSIONS, requirePermission } from '$lib/server/auth/permissions';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { loadCommunicationFilterOptions } from '$lib/server/communications';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!requirePermission(locals, PERMISSIONS.VIEW_COMMUNICATION_CENTER)) {
		throw error(403, 'You do not have permission to access the communication center.');
	}

	if (!event.platform?.env?.DB) {
		return {
			messages: [],
			filterOptions: {
				memberRoles: [],
				memberSexes: [],
				rosterRoles: [],
				teamStatuses: [],
				seasons: [],
				offerings: [],
				leagues: [],
				divisions: [],
				teams: []
			},
			selectedMessage: null
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = getCentralDbOps(event);
	const selectedMessageId = url.searchParams.get('messageId')?.trim() || null;
	const [messages, filterOptions, selectedMessage] = await Promise.all([
		dbOps.communications.listMessageSummaries(clientId, 40),
		loadCommunicationFilterOptions(dbOps, clientId),
		selectedMessageId ? dbOps.communications.getMessageDetail(clientId, selectedMessageId) : null
	]);

	locals.requestLogMeta = {
		table:
			'communication_messages,communication_message_batches,communication_message_recipients,users,user_clients,rosters,teams,divisions,leagues,offerings,seasons',
		recordCount: messages.length
	};

	return {
		messages,
		filterOptions,
		selectedMessage
	};
};
