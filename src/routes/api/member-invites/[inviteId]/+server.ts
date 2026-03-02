import { json } from '@sveltejs/kit';
import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { isAdminLikeRole } from '$lib/server/auth/rbac';
import { inviteActionSchema } from '$lib/server/members/validation';
import { buildMemberInviteUrl, generateMemberInviteToken, getMemberInviteExpiryIso, hashMemberInviteToken } from '$lib/server/members/invites';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Database is unavailable.' }, { status: 500 });
	}

	if (!isAdminLikeRole(event.locals.user?.role)) {
		return json(
			{ success: false, error: 'Only administrators and developers can manage invites.' },
			{ status: 403 }
		);
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = inviteActionSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const clientId = requireAuthenticatedClientId(event.locals);
	const userId = requireAuthenticatedUserId(event.locals);
	const dbOps = getCentralDbOps(event);

	if (parsed.data.action === 'revoke') {
		const revoked = await dbOps.members.revokeInvite({
			inviteId: event.params.inviteId,
			clientId,
			updatedUser: userId
		});
		if (!revoked) {
			return json({ success: false, error: 'Unable to revoke invite.' }, { status: 404 });
		}

		return json({
			success: true,
			data: {
				inviteId: event.params.inviteId,
				action: 'revoke'
			}
		});
	}

	const token = generateMemberInviteToken();
	const regenerated = await dbOps.members.regenerateInvite({
		inviteId: event.params.inviteId,
		clientId,
		tokenHash: await hashMemberInviteToken(token),
		expiresAt: getMemberInviteExpiryIso(),
		updatedUser: userId
	});
	if (!regenerated) {
		return json({ success: false, error: 'Unable to regenerate invite.' }, { status: 404 });
	}

	return json({
		success: true,
		data: {
			invite: regenerated,
			inviteUrl: buildMemberInviteUrl(event.url.origin, token),
			action: 'regenerate'
		}
	});
};
