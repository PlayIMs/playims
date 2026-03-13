import { getCentralDbOps } from '$lib/server/database/context';
import { hashMemberInviteToken } from '$lib/server/members/invites';
import type { PageServerLoad } from './$types';

const normalizeComparableEmail = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

export const load: PageServerLoad = async (event) => {
	const signInPath = `/log-in?next=${encodeURIComponent(`/accept-member-invite/${event.params.token}`)}`;
	const viewerSignedIn = Boolean(event.locals.user && event.locals.session);

	if (!event.platform?.env?.DB) {
		return {
			token: event.params.token,
			invite: null,
			error: 'Database is unavailable.',
			signInPath,
			viewerSignedIn,
			viewerMatchesInvite: false
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
			error: 'Invite is expired, revoked, or invalid.',
			signInPath,
			viewerSignedIn,
			viewerMatchesInvite: false
		};
	}

	const viewerMatchesInvite =
		viewerSignedIn &&
		normalizeComparableEmail(event.locals.user?.email) === normalizeComparableEmail(invite.email);

	event.locals.requestLogMeta = {
		table: 'member_invites',
		recordCount: 1
	};

	return {
		token: event.params.token,
		invite,
		error: null,
		signInPath,
		viewerSignedIn,
		viewerMatchesInvite
	};
};
