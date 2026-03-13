import { json } from '@sveltejs/kit';
import { getCentralDbOps } from '$lib/server/database/context';
import {
	acceptMemberInviteNewAccountSchema,
	acceptMemberInviteSchema
} from '$lib/server/members/validation';
import { hashMemberInviteToken } from '$lib/server/members/invites';
import { AUTH_ENV_KEYS } from '$lib/server/auth/constants';
import { createSessionForUser } from '$lib/server/auth/session';
import { hashPassword, normalizeIterations } from '$lib/server/auth/password';
import { requireSessionSecret, resolvePasswordPepper } from '$lib/server/auth/service';
import type { RequestHandler } from './$types';

const AUTH_PASSWORD_ITERATIONS_KEY = AUTH_ENV_KEYS.passwordIterations;

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
	const tokenHash = await hashMemberInviteToken(parsed.data.token);
	const invite = await dbOps.members.getInvitePreviewByTokenHash(tokenHash);
	if (!invite) {
		return json(
			{ success: false, error: 'Invite is expired, revoked, or invalid.' },
			{ status: 404 }
		);
	}

	const signedInUserId = event.locals.user && event.locals.session ? event.locals.user.id : null;
	if (invite.accountMode === 'existing-account') {
		const accepted = await dbOps.members.acceptInvite({
			tokenHash,
			actorUserId: signedInUserId,
			createdUser: null
		});

		if (accepted.status === 'authentication-required') {
			return json(
				{
					success: false,
					error: 'This invite is for an email that already has a PlayIMs account. Sign in with that account to accept the invite.'
				},
				{ status: 409 }
			);
		}

		if (accepted.status === 'wrong-user') {
			return json(
				{
					success: false,
					error: `This invite must be accepted by the PlayIMs account for ${accepted.email}. Sign out and sign in with that email to continue.`
				},
				{ status: 403 }
			);
		}

		if (accepted.status === 'invalid-invite') {
			return json(
				{ success: false, error: 'Invite is expired, revoked, or invalid.' },
				{ status: 404 }
			);
		}

		return json({
			success: true,
			data: {
				session: event.locals.session ?? null,
				user: event.locals.user ?? null,
				createdUser: accepted.createdUser,
				reactivatedMembership: accepted.reactivatedMembership,
				reusedExistingSession: true
			}
		});
	}

	const newAccountParsed = acceptMemberInviteNewAccountSchema.safeParse(body);
	if (!newAccountParsed.success) {
		return json(
			{
				success: false,
				error: 'Invalid request payload.',
				fieldErrors: toFieldErrorMap(newAccountParsed.error.issues)
			},
			{ status: 400 }
		);
	}

	const passwordHash = await hashPassword({
		password: newAccountParsed.data.password,
		pepper: resolvePasswordPepper(event),
		iterations: readIterations(event)
	});
	const accepted = await dbOps.members.acceptInvite({
		tokenHash,
		passwordHash,
		firstName: newAccountParsed.data.firstName,
		lastName: newAccountParsed.data.lastName,
		actorUserId: signedInUserId,
		createdUser: null
	});
	if (accepted.status === 'invalid-invite') {
		return json(
			{ success: false, error: 'Invite is expired, revoked, or invalid.' },
			{ status: 404 }
		);
	}

	if (accepted.status === 'authentication-required') {
		return json(
			{
				success: false,
				error: 'This invite is for an email that already has a PlayIMs account. Sign in with that account to accept the invite.'
			},
			{ status: 409 }
		);
	}

	if (accepted.status === 'wrong-user') {
		return json(
			{
				success: false,
				error: `This invite must be accepted by the PlayIMs account for ${accepted.email}. Sign out and sign in with that email to continue.`
			},
			{ status: 403 }
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
