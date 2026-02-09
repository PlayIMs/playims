import type { DatabaseOperations } from '$lib/database';

/**
 * Default "organization" client used for admin/dev testing until auth is implemented.
 *
 * Future-proofing:
 * - Once login is added, `locals.user.clientId` will become the source of truth.
 * - Until then, all admin pages should use this default client (and NEVER show a client selector).
 */
export const DEFAULT_CLIENT = {
	id: '6eb657af-4ab8-4a13-980a-add993f78d65',
	name: 'PlayIMs Admin Test',
	slug: 'playims-admin'
} as const;

export function resolveClientId(locals: App.Locals): string {
	return locals.user?.clientId ?? DEFAULT_CLIENT.id;
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
