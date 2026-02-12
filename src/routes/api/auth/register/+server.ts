import { DatabaseOperations } from '$lib/database';
import { AuthServiceError, registerWithPassword } from '$lib/server/auth/service';
import { registerSchema } from '$lib/server/auth/validation';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Public endpoint: invite-key registration + immediate session creation.
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

	const parsed = registerSchema.safeParse(body);
	if (!parsed.success) {
		return json({ success: false, error: 'Invalid request payload.' }, { status: 400 });
	}

	try {
		const dbOps = new DatabaseOperations(event.platform as App.Platform);
		const authResult = await registerWithPassword(event, dbOps, {
			email: parsed.data.email,
			password: parsed.data.password,
			inviteKey: parsed.data.inviteKey,
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName
		});

		return json({
			success: true,
			data: authResult
		});
	} catch (error) {
		if (error instanceof AuthServiceError) {
			return json({ success: false, error: error.clientMessage, code: error.code }, { status: error.status });
		}

		return json({ success: false, error: 'Failed to register account.' }, { status: 500 });
	}
};
