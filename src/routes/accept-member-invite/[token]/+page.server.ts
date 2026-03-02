import { getCentralDbOps } from '$lib/server/database/context';
import { hashMemberInviteToken } from '$lib/server/members/invites';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (!event.platform?.env?.DB) {
		return {
			token: event.params.token,
			invite: null,
			error: 'Database is unavailable.'
		};
	}

	const dbOps = getCentralDbOps(event);
	const invite = await dbOps.members.getInvitePreviewByTokenHash(
		await hashMemberInviteToken(event.params.token)
	);

	if (!invite) {
		return {
			token: event.params.token,
			invite: null,
			error: 'Invite is expired, revoked, or invalid.'
		};
	}

	event.locals.requestLogMeta = {
		table: 'member_invites',
		recordCount: 1
	};

	return {
		token: event.params.token,
		invite,
		error: null
	};
};
