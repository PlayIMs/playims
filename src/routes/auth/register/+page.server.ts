import { DatabaseOperations } from '$lib/database';
import { DASHBOARD_ALLOWED_ROLES, hasAnyRole } from '$lib/server/auth/rbac';
import { AuthServiceError, registerWithPassword } from '$lib/server/auth/service';
import { registerSchema } from '$lib/server/auth/validation';
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
	password: 'Password',
	confirmPassword: 'Confirm password',
	inviteKey: 'Invite key',
	firstName: 'First name',
	lastName: 'Last name'
};

const getValidationMessage = (issues: { path: PropertyKey[]; message: string }[]) => {
	const issue = issues[0];
	if (!issue) {
		return 'Please complete all required fields with valid values.';
	}

	const fieldKey = String(issue.path[0] ?? '');
	const label = FIELD_LABELS[fieldKey];
	if (label) {
		return `${label}: ${issue.message}`;
	}

	return issue.message || 'Please complete all required fields with valid values.';
};

// If already authenticated with required role, skip register page.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user && hasAnyRole(locals.user.role, DASHBOARD_ALLOWED_ROLES)) {
		const nextPath = sanitizeNextPath(url.searchParams.get('next'));
		throw redirect(303, nextPath ?? '/dashboard');
	}

	return {
		next: sanitizeNextPath(url.searchParams.get('next')) ?? '/dashboard'
	};
};

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform?.env?.DB) {
			return fail(500, { error: 'Authentication is unavailable.' });
		}

		const formData = await event.request.formData();
		const nextPath = sanitizeNextPath(formData.get('next')?.toString()) ?? '/dashboard';
		const parsed = registerSchema.safeParse({
			email: formData.get('email')?.toString(),
			password: formData.get('password')?.toString(),
			confirmPassword: formData.get('confirmPassword')?.toString(),
			inviteKey: formData.get('inviteKey')?.toString(),
			firstName: formData.get('firstName')?.toString(),
			lastName: formData.get('lastName')?.toString(),
			next: nextPath
		});

		if (!parsed.success) {
			return fail(400, {
				error: getValidationMessage(parsed.error.issues),
				next: nextPath,
				email: formData.get('email')?.toString() ?? '',
				firstName: formData.get('firstName')?.toString() ?? '',
				lastName: formData.get('lastName')?.toString() ?? ''
			});
		}

		try {
			const dbOps = new DatabaseOperations(event.platform as App.Platform);
			await registerWithPassword(event, dbOps, {
				email: parsed.data.email,
				password: parsed.data.password,
				inviteKey: parsed.data.inviteKey,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName
			});
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return fail(error.status, {
					error: error.clientMessage,
					next: nextPath,
					email: parsed.data.email,
					firstName: parsed.data.firstName ?? '',
					lastName: parsed.data.lastName ?? ''
				});
			}

			return fail(500, {
				error: 'Unable to register right now.',
				next: nextPath,
				email: parsed.data.email,
				firstName: parsed.data.firstName ?? '',
				lastName: parsed.data.lastName ?? ''
			});
		}

		throw redirect(303, nextPath);
	}
};
