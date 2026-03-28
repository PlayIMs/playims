import type { DatabaseOperations } from '$lib/database';
import type { RequestEvent } from '@sveltejs/kit';

export async function persistAuthenticatedPasswordChange(input: {
	event: RequestEvent;
	dbOps: DatabaseOperations;
	userId: string;
	clientId: string;
	passwordHash: string;
	clearMustChangePassword?: boolean;
}): Promise<boolean> {
	const updated = await input.dbOps.users.updateSelfPasswordHash({
		userId: input.userId,
		clientId: input.clientId,
		passwordHash: input.passwordHash,
		updatedUser: input.userId,
		mustChangePassword: input.clearMustChangePassword ? false : undefined
	});

	if (!updated) {
		return false;
	}

	if (input.event.locals.session?.id) {
		await input.dbOps.sessions.revokeAllForUserExceptSessionInClient(
			input.userId,
			input.clientId,
			input.event.locals.session.id
		);
	}

	if (input.event.locals.user) {
		input.event.locals.user = {
			...input.event.locals.user,
			mustChangePassword: false
		};
	}

	return true;
}
