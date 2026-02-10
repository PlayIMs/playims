import { DatabaseOperations } from '$lib/database';
import { AuthServiceError, loginWithPassword } from '$lib/server/auth/service';
import { loginSchema } from '$lib/server/auth/validation';
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

	const parsed = loginSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	try {
		const dbOps = new DatabaseOperations(event.platform as App.Platform);
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
			return json({ success: false, error: error.clientMessage, code: error.code }, { status: error.status });
		}

		return json({ success: false, error: 'Failed to log in.' }, { status: 500 });
	}
};
