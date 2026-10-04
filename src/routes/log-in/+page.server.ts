import { resolvePostAuthRedirect, sanitizeAuthRedirectPath } from '$lib/server/auth/navigation';
import { isLocalDevCredentialPair, isLocalhostHostname } from '$lib/server/auth/local-dev';
import {
	AuthServiceError,
	loginWithLocalDevCredentials,
	loginWithPassword
} from '$lib/server/auth/service';
import { loginSchema } from '$lib/server/auth/validation';
import { getCentralDbOps } from '$lib/server/database/context';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Only allow internal app redirects to prevent open redirect abuse.
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

const genericLoginFailureMessage = 'Sign-in failed. Check your email and password and try again.';
const genericLoginUnavailableMessage = 'Sign-in is temporarily unavailable. Please try again.';
const genericLoginFailureCode = 'AUTH_LOGIN_FAILED';
const genericLoginUnavailableCode = 'AUTH_LOGIN_UNAVAILABLE';

const getLoginFailureReason = (error: unknown): string => {
	if (error instanceof AuthServiceError) {
		return error.code === 'AUTH_CONFIG_MISSING' ? 'AUTH_CONFIG_MISSING' : 'AUTH_SERVICE_FAILURE';
	}

	// Drizzle wraps D1 exceptions in `cause`. Inspect a bounded chain, but never log raw
	// messages: query errors can contain user data, parameters or configuration secrets.
	let current = error;
	let databaseFailure = false;
	for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
		const message = current.message;
		if (/iteration counts above \d+.*not supported/i.test(message)) {
			return 'PASSWORD_HASH_RUNTIME_LIMIT';
		}
		if (/no such (?:table|column)/i.test(message)) {
			return 'DATABASE_SCHEMA_MISMATCH';
		}
		databaseFailure ||= /D1_ERROR|failed query/i.test(message);
		current = current.cause;
	}
	return databaseFailure ? 'DATABASE_FAILURE' : 'UNEXPECTED_ERROR';
};

const logLoginBackendFailure = (requestId: string | undefined, error: unknown) => {
	// Expected credential rejections stay quiet; only unavailable backend failures need diagnostics.
	if (error instanceof AuthServiceError && error.status < 500) return;
	console.error('[auth][login] Backend failure', {
		requestId,
		reason: getLoginFailureReason(error)
	});
};

const mapLoginAuthError = (error: AuthServiceError) => {
	if (error.status >= 500 || error.code === 'AUTH_CONFIG_MISSING') {
		return {
			error: genericLoginUnavailableMessage,
			errorCode: genericLoginUnavailableCode,
			errorStatus: error.status
		};
	}

	return {
		error: genericLoginFailureMessage,
		errorCode: genericLoginFailureCode,
		errorStatus: error.status
	};
};

// If already authenticated with required role, skip login page.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user && locals.session) {
		throw redirect(
			303,
			resolvePostAuthRedirect({
				nextPath: url.searchParams.get('next'),
				role: locals.user.role,
				mustChangePassword: locals.user.mustChangePassword === true
			})
		);
	}

	return {
		next: sanitizeAuthRedirectPath(url.searchParams.get('next')) ?? '',
		allowLocalDevLogin: isLocalhostHostname(url.hostname)
	};
};

export const actions: Actions = {
	default: async (event) => {
		if (!event.platform?.env?.DB) {
			console.error('[auth][login] Backend failure', {
				requestId: event.locals.requestId,
				reason: 'DATABASE_BINDING_MISSING'
			});
			return fail(500, { error: 'Authentication is unavailable.' });
		}

		const formData = await event.request.formData();
		const submittedNextPath = formData.get('next')?.toString();
		const nextPath = sanitizeAuthRedirectPath(submittedNextPath) ?? '';
		const emailInput = formData.get('email')?.toString() ?? '';
		const passwordInput = formData.get('password')?.toString() ?? '';
		let authResult:
			| Awaited<ReturnType<typeof loginWithLocalDevCredentials>>
			| Awaited<ReturnType<typeof loginWithPassword>>;

		if (isLocalDevCredentialPair(emailInput, passwordInput)) {
			try {
				const dbOps = getCentralDbOps(event);
				authResult = await loginWithLocalDevCredentials(event, dbOps);
			} catch (error) {
				logLoginBackendFailure(event.locals.requestId, error);
				if (error instanceof AuthServiceError) {
					const publicAuthError = mapLoginAuthError(error);
					return fail(error.status, {
						error: publicAuthError.error,
						errorCode: publicAuthError.errorCode,
						errorStatus: publicAuthError.errorStatus,
						next: nextPath,
						email: emailInput
					});
				}

				return fail(500, {
					error: genericLoginUnavailableMessage,
					errorCode: genericLoginUnavailableCode,
					errorStatus: 500,
					next: nextPath,
					email: emailInput
				});
			}

			throw redirect(
				303,
				resolvePostAuthRedirect({
					nextPath: submittedNextPath,
					role: authResult.session.role,
					mustChangePassword: authResult.user.mustChangePassword === true
				})
			);
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
			const dbOps = getCentralDbOps(event);
			authResult = await loginWithPassword(event, dbOps, {
				email: parsed.data.email,
				password: parsed.data.password
			});
		} catch (error) {
			logLoginBackendFailure(event.locals.requestId, error);
			if (error instanceof AuthServiceError) {
				const publicAuthError = mapLoginAuthError(error);
				return fail(error.status, {
					error: publicAuthError.error,
					errorCode: publicAuthError.errorCode,
					errorStatus: publicAuthError.errorStatus,
					next: nextPath,
					email: parsed.data.email
				});
			}

			return fail(500, {
				error: genericLoginUnavailableMessage,
				errorCode: genericLoginUnavailableCode,
				errorStatus: 500,
				next: nextPath,
				email: parsed.data.email
			});
		}

		throw redirect(
			303,
			resolvePostAuthRedirect({
				nextPath: submittedNextPath,
				role: authResult.session.role,
				mustChangePassword: authResult.user.mustChangePassword === true
			})
		);
	}
};
