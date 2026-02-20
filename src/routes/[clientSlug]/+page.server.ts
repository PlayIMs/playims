import { error } from '@sveltejs/kit';
import { getCentralDbOps } from '$lib/server/database/context';
import { isReservedClientSlug, normalizeClientSlug } from '$lib/server/client-slug';
import type { PageServerLoad } from './$types';

const isActiveStatus = (value: string | null | undefined): boolean =>
	(value?.trim().toLowerCase() ?? 'active') === 'active';

type MembershipState = 'none' | 'active' | 'inactive';

export const load: PageServerLoad = async (event) => {
	const { params, locals } = event;

	if (!event.platform?.env?.DB) {
		throw error(500, 'Database is not configured.');
	}

	const normalizedSlug = normalizeClientSlug(params.clientSlug);
	if (!normalizedSlug || isReservedClientSlug(normalizedSlug)) {
		throw error(404, 'Organization not found.');
	}

	const dbOps = getCentralDbOps(event);
	const client = await dbOps.clients.getByNormalizedSlug(normalizedSlug);
	if (!client?.id || !isActiveStatus(client.status)) {
		throw error(404, 'Organization not found.');
	}

	const nextPath = `/${normalizedSlug}`;
	const loginPath = `/log-in?next=${encodeURIComponent(nextPath)}`;
	const registerPath = `/register?next=${encodeURIComponent(nextPath)}`;

	let membershipState: MembershipState = 'none';
	let membershipRole: string | null = null;
	if (locals.user?.id) {
		const membership = await dbOps.userClients.getMembership(locals.user.id, client.id);
		if (membership) {
			membershipState = isActiveStatus(membership.status) ? 'active' : 'inactive';
			membershipRole = membership.role ?? null;
		}
	}

	return {
		client: {
			id: client.id,
			name: client.name?.trim() || 'Organization',
			slug: client.slug?.trim() || normalizedSlug,
			selfJoinEnabled: client.selfJoinEnabled === 1
		},
		auth: {
			isAuthenticated: Boolean(locals.user && locals.session),
			activeClientId: locals.session?.activeClientId ?? null,
			membershipState,
			membershipRole
		},
		nextPath,
		loginPath,
		registerPath
	};
};
