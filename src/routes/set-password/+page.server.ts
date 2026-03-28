import {
	requireAuthenticatedClientId,
	requireAuthenticatedUserId
} from '$lib/server/client-context';
import { AUTH_ENV_KEYS } from '$lib/server/auth/constants';
import {
	buildPasswordSetupLocation,
	resolvePostAuthRedirect,
	sanitizeAuthRedirectPath
} from '$lib/server/auth/navigation';
import { persistAuthenticatedPasswordChange } from '$lib/server/auth/password-update';
import { hashPassword, normalizeIterations } from '$lib/server/auth/password';
import { revokeCurrentSession } from '$lib/server/auth/session';
import { resolvePasswordPepper } from '$lib/server/auth/service';
import { passwordSetupSchema } from '$lib/server/auth/validation';
import { getCentralDbOps } from '$lib/server/database/context';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const FIELD_LABELS: Record<string, string> = {
	newPassword: 'New password',
	confirmPassword: 'Confirm password'
};

const getValidationMessage = (issues: { path: PropertyKey[]; message: string }[]) => {
	const issue = issues[0];
	if (!issue) {
		return 'Please provide and confirm your new password.';
	}

	const fieldKey = String(issue.path[0] ?? '');
	const label = FIELD_LABELS[fieldKey];
	if (label) {
		return `${label}: ${issue.message}`;
	}

	return issue.message || 'Please provide and confirm your new password.';
};

const readAuthEnv = (event: Pick<RequestEvent, 'platform'>, key: string): string | undefined => {
	const platformValue = (event.platform?.env as Record<string, unknown> | undefined)?.[key];
	if (typeof platformValue === 'string' && platformValue.trim().length > 0) {
		return platformValue.trim();
	}

	const nodeValue = process.env[key];
	if (typeof nodeValue === 'string' && nodeValue.trim().length > 0) {
		return nodeValue.trim();
	}

	return undefined;
};

const resolvePasswordIterations = (event: Pick<RequestEvent, 'platform'>) =>
	normalizeIterations(readAuthEnv(event, AUTH_ENV_KEYS.passwordIterations));

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || !locals.session) {
		throw redirect(303, `/log-in?next=${encodeURIComponent('/set-password')}`);
	}

	if (!locals.user.mustChangePassword) {
		throw redirect(
			303,
			resolvePostAuthRedirect({
				nextPath: url.searchParams.get('next'),
				role: locals.user.role,
				mustChangePassword: false
			})
		);
	}

	return {
		next: sanitizeAuthRedirectPath(url.searchParams.get('next')) ?? '',
		email: locals.user.email ?? ''
	};
};

export const actions: Actions = {
	setPassword: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, {
				error: 'Password setup is temporarily unavailable.'
			});
		}

		if (!event.locals.user || !event.locals.session) {
			throw redirect(303, buildPasswordSetupLocation(null));
		}

		const formData = await event.request.formData();
		const nextPath = sanitizeAuthRedirectPath(formData.get('next')?.toString()) ?? '';
		const parsed = passwordSetupSchema.safeParse({
			newPassword: formData.get('newPassword')?.toString(),
			confirmPassword: formData.get('confirmPassword')?.toString(),
			next: nextPath
		});

		if (!parsed.success) {
			return fail(400, {
				error: getValidationMessage(parsed.error.issues),
				next: nextPath
			});
		}

		if (!event.locals.user.mustChangePassword) {
			throw redirect(
				303,
				resolvePostAuthRedirect({
					nextPath,
					role: event.locals.user.role,
					mustChangePassword: false
				})
			);
		}

		const dbOps = getCentralDbOps(event);
		const userId = requireAuthenticatedUserId(event.locals);
		const clientId = requireAuthenticatedClientId(event.locals);
		const user = await dbOps.users.getAuthByIdForClient(userId, clientId);
		if (!user || user.status !== 'active') {
			return fail(400, {
				error: 'Unable to update password for this account.',
				next: nextPath
			});
		}

		let passwordPepper: string;
		try {
			passwordPepper = resolvePasswordPepper(event);
		} catch {
			return fail(500, {
				error: 'Password setup is temporarily unavailable.',
				next: nextPath
			});
		}

		const newPasswordHash = await hashPassword({
			password: parsed.data.newPassword,
			pepper: passwordPepper,
			iterations: resolvePasswordIterations(event)
		});

		const updated = await persistAuthenticatedPasswordChange({
			event,
			dbOps,
			userId,
			clientId,
			passwordHash: newPasswordHash,
			clearMustChangePassword: true
		});
		if (!updated) {
			return fail(500, {
				error: 'Failed to update password.',
				next: nextPath
			});
		}

		throw redirect(
			303,
			resolvePostAuthRedirect({
				nextPath,
				role: event.locals.user.role,
				mustChangePassword: false
			})
		);
	},

	signOut: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { error: 'Authentication is unavailable.' });
		}

		const dbOps = getCentralDbOps(event);
		await revokeCurrentSession(event, dbOps);
		throw redirect(303, '/log-in');
	}
};
