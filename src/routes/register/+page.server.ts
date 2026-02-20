import { DASHBOARD_ALLOWED_ROLES, hasAnyRole } from '$lib/server/auth/rbac';
import { AuthServiceError, registerWithPassword } from '$lib/server/auth/service';
import { registerSchema } from '$lib/server/auth/validation';
import { getCentralDbOps } from '$lib/server/database/context';
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

const genericRegisterFailureMessage =
	'Registration failed. Check your account details and invite key, then try again.';
const genericRegisterUnavailableMessage = 'Registration is temporarily unavailable. Please try again.';
const genericRegisterFailureCode = 'AUTH_REGISTER_FAILED';
const genericRegisterUnavailableCode = 'AUTH_REGISTER_UNAVAILABLE';

const mapRegisterAuthError = (error: AuthServiceError) => {
	if (error.code === 'AUTH_EMAIL_ALREADY_REGISTERED') {
		return {
			error: 'An account with this email already exists. Please sign in instead.',
			errorCode: 'AUTH_EMAIL_ALREADY_REGISTERED',
			errorStatus: 409
		};
	}

	if (error.status >= 500 || error.code === 'AUTH_CONFIG_MISSING' || error.code === 'AUTH_CREATE_FAILED') {
		return {
			error: genericRegisterUnavailableMessage,
			errorCode: genericRegisterUnavailableCode,
			errorStatus: error.status
		};
	}

	return {
		error: genericRegisterFailureMessage,
		errorCode: genericRegisterFailureCode,
		errorStatus: error.status
	};
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
			const dbOps = getCentralDbOps(event);
			await registerWithPassword(event, dbOps, {
				email: parsed.data.email,
				password: parsed.data.password,
				inviteKey: parsed.data.inviteKey,
				firstName: parsed.data.firstName,
				lastName: parsed.data.lastName
			});
		} catch (error) {
			if (error instanceof AuthServiceError) {
				const publicAuthError = mapRegisterAuthError(error);
				return fail(publicAuthError.errorStatus, {
					error: publicAuthError.error,
					errorCode: publicAuthError.errorCode,
					errorStatus: publicAuthError.errorStatus,
					next: nextPath,
					email: parsed.data.email,
					firstName: parsed.data.firstName ?? '',
					lastName: parsed.data.lastName ?? ''
				});
			}

			return fail(500, {
				error: genericRegisterUnavailableMessage,
				errorCode: genericRegisterUnavailableCode,
				errorStatus: 500,
				next: nextPath,
				email: parsed.data.email,
				firstName: parsed.data.firstName ?? '',
				lastName: parsed.data.lastName ?? ''
			});
		}

		throw redirect(303, nextPath);
	}
};
