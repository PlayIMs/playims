import { isLocalDevCredentialPair } from '$lib/server/auth/local-dev';
import {
	AuthServiceError,
	loginWithLocalDevCredentials,
	loginWithPassword
} from '$lib/server/auth/service';
import { loginSchema } from '$lib/server/auth/validation';
import { getCentralDbOps } from '$lib/server/database/context';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Public endpoint: email/password login + session cookie issuance.
export const POST: RequestHandler = async (event) => {
	if (!event.platform?.env?.DB) {
		return json({ success: false, error: 'Authentication is unavailable.' }, { status: 500 });
	}

	let body: unknown;
	try {
		body = (await event.request.json()) as unknown;
	} catch {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	const rawBody =
		body && typeof body === 'object' && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: null;
	const emailInput = typeof rawBody?.email === 'string' ? rawBody.email : null;
	const passwordInput = typeof rawBody?.password === 'string' ? rawBody.password : null;

	if (isLocalDevCredentialPair(emailInput, passwordInput)) {
		try {
			const dbOps = getCentralDbOps(event);
			const authResult = await loginWithLocalDevCredentials(event, dbOps);
			return json({
				success: true,
				data: authResult
			});
		} catch (error) {
			if (error instanceof AuthServiceError) {
				return json(
					{ success: false, error: error.clientMessage, code: error.code },
					{ status: error.status }
				);
			}

			return json({ success: false, error: 'Failed to log in.' }, { status: 500 });
		}
	}

	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	try {
		const dbOps = getCentralDbOps(event);
		const authResult = await loginWithPassword(event, dbOps, {
			email: parsed.data.email,
			password: parsed.data.password
		});

		return json({
			success: true,
			data: authResult
		});
	} catch (error) {
		if (error instanceof AuthServiceError) {
			return json(
				{ success: false, error: error.clientMessage, code: error.code },
				{ status: error.status }
			);
		}

		return json({ success: false, error: 'Failed to log in.' }, { status: 500 });
	}
};
