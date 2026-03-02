import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { memberListQuerySchema } from '$lib/server/members/validation';
import { isAdminLikeRole, normalizeRole } from '$lib/server/auth/rbac';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { platform, locals, url } = event;
	const parsedQuery = memberListQuerySchema.parse({
		q: url.searchParams.get('q'),
		sex: url.searchParams.get('sex'),
		role: url.searchParams.get('role'),
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') ?? undefined,
		page: url.searchParams.get('page') ?? undefined
	});

	if (!platform?.env?.DB) {
		return {
			members: {
				rows: [],
				page: 1,
				pageSize: 50,
				totalCount: 0,
				hasNextPage: false,
				hasPreviousPage: false,
				sort: parsedQuery.sort,
				dir: parsedQuery.dir,
				query: parsedQuery.q.trim(),
				sexFilter: parsedQuery.sex ?? null,
				roleFilter: parsedQuery.role ?? null
			},
			pendingInvites: [],
			capabilities: {
				canAddMembers: false,
				canManageRoles: false,
				canRemoveMembers: false
			},
			error: 'Database is unavailable.'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = getCentralDbOps(event);
	const shouldSearch = parsedQuery.q.trim().length >= 2;
	const [memberResult, pendingInvites] = await Promise.all([
		shouldSearch
			? dbOps.members.searchByClient({
					clientId,
					query: parsedQuery.q,
					page: parsedQuery.page,
					sex: parsedQuery.sex ?? null,
					role: parsedQuery.role ?? null,
					sort: parsedQuery.sort,
					dir: parsedQuery.dir
				})
			: dbOps.members.listByClient({
					clientId,
					page: parsedQuery.page,
					sex: parsedQuery.sex ?? null,
					role: parsedQuery.role ?? null,
					sort: parsedQuery.sort,
					dir: parsedQuery.dir
				}),
		dbOps.members.listPendingInvites(clientId)
	]);

	locals.requestLogMeta = {
		table: 'users,user_clients,member_invites',
		recordCount: memberResult.rows.length + pendingInvites.length
	};

	const effectiveRole = normalizeRole(locals.user?.role);
	const canAdministerMembers = isAdminLikeRole(effectiveRole);

	return {
		members: {
			rows: memberResult.rows,
			page: memberResult.page,
			pageSize: 50,
			totalCount: memberResult.totalCount,
			hasNextPage: memberResult.hasNextPage,
			hasPreviousPage: memberResult.hasPreviousPage,
			sort: parsedQuery.sort,
			dir: parsedQuery.dir,
			query: parsedQuery.q.trim(),
			sexFilter: parsedQuery.sex ?? null,
			roleFilter: parsedQuery.role ?? null
		},
		pendingInvites,
		capabilities: {
			canAddMembers: canAdministerMembers,
			canManageRoles: canAdministerMembers,
			canRemoveMembers: canAdministerMembers
		}
	};
};
