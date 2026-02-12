import type { DatabaseOperations } from '$lib/database';

/**
 * Default organization used for controlled bootstrap flows (for example invite-key signup).
 * Authenticated routes must use `requireAuthenticatedClientId` instead of default fallback.
 */
export const DEFAULT_CLIENT = {
	id: '6eb657af-4ab8-4a13-980a-add993f78d65',
	name: 'PlayIMs Admin Test',
	slug: 'playims-admin'
} as const;

export function resolveClientId(locals: App.Locals): string {
	return locals.session?.activeClientId ?? locals.session?.clientId ?? locals.user?.clientId ?? DEFAULT_CLIENT.id;
}

export function requireAuthenticatedClientId(locals: App.Locals): string {
	const clientId =
		locals.session?.activeClientId?.trim() ??
		locals.session?.clientId?.trim() ??
		locals.user?.clientId?.trim();
	if (!clientId) {
		throw new Error('AUTH_CLIENT_CONTEXT_REQUIRED');
	}
	return clientId;
}

export function requireAuthenticatedUserId(locals: App.Locals): string {
	const userId = locals.user?.id?.trim();
	if (!userId) {
		throw new Error('AUTH_USER_CONTEXT_REQUIRED');
	}
	return userId;
}

/**
 * Ensure the default client exists in the database.
 * Intended for dev/test convenience; safe to call on server load.
 */
export async function ensureDefaultClient(dbOps: DatabaseOperations) {
	const existing = await dbOps.clients.getById(DEFAULT_CLIENT.id);
	if (existing) return existing;

	const created = await dbOps.clients.create({
		id: DEFAULT_CLIENT.id,
		name: DEFAULT_CLIENT.name,
		slug: DEFAULT_CLIENT.slug,
		metadata: undefined,
		createdUser: undefined,
		updatedUser: undefined
	});

	return created ?? (await dbOps.clients.getById(DEFAULT_CLIENT.id));
}
