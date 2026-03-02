import { json } from '@sveltejs/kit';
import { getCentralDbOps } from '$lib/server/database/context';
import { acceptMemberInviteSchema } from '$lib/server/members/validation';
import { hashMemberInviteToken } from '$lib/server/members/invites';
import { createSessionForUser } from '$lib/server/auth/session';
import { hashPassword, normalizeIterations } from '$lib/server/auth/password';
import { requireSessionSecret, resolvePasswordPepper } from '$lib/server/auth/service';
import type { RequestHandler } from './$types';

const AUTH_PASSWORD_ITERATIONS_KEY = 'AUTH_PASSWORD_ITERATIONS';

const readIterations = (event: Parameters<typeof resolvePasswordPepper>[0]): number => {
	const platformValue = (event.platform?.env as Record<string, unknown> | undefined)?.[
		AUTH_PASSWORD_ITERATIONS_KEY
	];
	if (typeof platformValue === 'string' && platformValue.trim().length > 0) {
		return normalizeIterations(platformValue.trim());
	}

	const nodeValue = process.env[AUTH_PASSWORD_ITERATIONS_KEY];
	return normalizeIterations(typeof nodeValue === 'string' ? nodeValue : undefined);
};

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

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const parsed = acceptMemberInviteSchema.safeParse(body);
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

	const dbOps = getCentralDbOps(event);
	const passwordHash = await hashPassword({
		password: parsed.data.password,
		pepper: resolvePasswordPepper(event),
		iterations: readIterations(event)
	});
	const accepted = await dbOps.members.acceptInvite({
		tokenHash: await hashMemberInviteToken(parsed.data.token),
		passwordHash,
		firstName: parsed.data.firstName,
		lastName: parsed.data.lastName,
		createdUser: null
	});
	if (!accepted) {
		return json(
			{ success: false, error: 'Invite is expired, revoked, or invalid.' },
			{ status: 404 }
		);
	}

	const markedLoginUser = await dbOps.users.markLoginSuccess(accepted.user.id);
	const authResult = await createSessionForUser(
		event,
		dbOps,
		markedLoginUser ?? accepted.user,
		requireSessionSecret(event),
		{
			activeClientId: accepted.clientId,
			activeRole: accepted.role
		}
	);

	return json({
		success: true,
		data: {
			session: authResult.session,
			user: authResult.user,
			createdUser: accepted.createdUser,
			reactivatedMembership: accepted.reactivatedMembership
		}
	});
};
