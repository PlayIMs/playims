import { DatabaseOperations } from '$lib/database';
import { DASHBOARD_ALLOWED_ROLES, hasAnyRole } from '$lib/server/auth/rbac';
import { isLocalDevCredentialPair, isLocalhostHostname } from '$lib/server/auth/local-dev';
import {
	AuthServiceError,
	loginWithLocalDevCredentials,
	loginWithPassword
} from '$lib/server/auth/service';
import { loginSchema } from '$lib/server/auth/validation';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Only allow internal app redirects to prevent open redirect abuse.
const sanitizeNextPath = (value: string | null | undefined) => {
	if (!value) {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/api/')) {
		return null;
	}
	return trimmed;
};

const FIELD_LABELS: Record<string, string> = {
	email: 'Email',
	password: 'Password'
};

const getValidationMessage = (issues: { path: PropertyKey[]; message: string }[]) => {
	const issue = issues[0];
	if (!issue) {
		return 'Please provide a valid email and password.';
	}

	const fieldKey = String(issue.path[0] ?? '');
	const label = FIELD_LABELS[fieldKey];
	if (label) {
		return `${label}: ${issue.message}`;
	}

	return issue.message || 'Please provide a valid email and password.';
};

// If already authenticated with required role, skip login page.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user && hasAnyRole(locals.user.role, DASHBOARD_ALLOWED_ROLES)) {
		const nextPath = sanitizeNextPath(url.searchParams.get('next'));
		throw redirect(303, nextPath ?? '/dashboard');
	}

	return {
		next: sanitizeNextPath(url.searchParams.get('next')) ?? '/dashboard',
		allowLocalDevLogin: isLocalhostHostname(url.hostname)
	};
};

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { error: 'Authentication is unavailable.' });
		}

		const formData = await event.request.formData();
		const nextPath = sanitizeNextPath(formData.get('next')?.toString()) ?? '/dashboard';
		const emailInput = formData.get('email')?.toString() ?? '';
		const passwordInput = formData.get('password')?.toString() ?? '';

		if (isLocalDevCredentialPair(emailInput, passwordInput)) {
			try {
				const dbOps = new DatabaseOperations(event.platform as App.Platform);
				await loginWithLocalDevCredentials(event, dbOps);
			} catch (error) {
				if (error instanceof AuthServiceError) {
					return fail(error.status, {
						error: error.clientMessage,
						next: nextPath,
						email: emailInput
					});
				}

				return fail(500, {
					error: 'Unable to log in right now.',
					next: nextPath,
					email: emailInput
				});
			}

			throw redirect(303, nextPath);
		}

		const parsed = loginSchema.safeParse({
			email: emailInput,
			password: passwordInput,
			next: nextPath
		});

		if (!parsed.success) {
			return fail(400, {
				error: getValidationMessage(parsed.error.issues),
				next: nextPath,
				email: emailInput
			});
		}

		try {
			const dbOps = new DatabaseOperations(event.platform as App.Platform);
			await loginWithPassword(event, dbOps, {
				email: parsed.data.email,
				password: parsed.data.password
			});
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return fail(error.status, {
					error: error.clientMessage,
					next: nextPath,
					email: parsed.data.email
				});
			}

			return fail(500, {
				error: 'Unable to log in right now.',
				next: nextPath,
				email: parsed.data.email
			});
		}

		throw redirect(303, nextPath);
	}
};
