import type {
	MemberListResponse,
	MemberRole,
	MemberSeasonFilterOption,
	MemberSex,
	MemberSortKey,
	SortDirection
} from '$lib/members/types.js';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps } from '$lib/server/database/context';
import { memberListQuerySchema } from '$lib/server/members/validation';
import {
	getMemberAssignableRoleOptions,
	PERMISSIONS,
	requirePermission
} from '$lib/server/auth/permissions';
import { readMemberSearchSelection } from '$lib/search/page-state.js';
import type { PageServerLoad } from './$types';

const buildEmptyMemberPayload = (input: {
	query: string;
	sort: MemberSortKey;
	dir: SortDirection;
	sexFilter: MemberSex | null;
	roleFilter: MemberRole | null;
	lastActiveSeasonId: string | null;
}): NonNullable<MemberListResponse['data']> => ({
	rows: [],
	page: 1,
	pageSize: 50,
	totalCount: 0,
	hasNextPage: false,
	hasPreviousPage: false,
	sort: input.sort,
	dir: input.dir,
	query: input.query,
	sexFilter: input.sexFilter,
	roleFilter: input.roleFilter,
	lastActiveSeasonId: input.lastActiveSeasonId
});

const toActiveSeasonOptions = (
	seasons: Array<{ id: string | null; name: string | null; isActive: number | null }>
): MemberSeasonFilterOption[] =>
	seasons
		.filter((season) => season.isActive === 1 && season.id?.trim() && season.name?.trim())
		.map((season) => ({
			value: season.id!.trim(),
			label: season.name!.trim()
		}));

export const load: PageServerLoad = async (event) => {
	const { platform, locals, url } = event;
	const { memberId } = readMemberSearchSelection(url);
	const parsedQuery = memberListQuerySchema.parse({
		q: url.searchParams.get('q'),
		sex: url.searchParams.get('sex'),
		role: url.searchParams.get('role'),
		lastActiveSeason: url.searchParams.get('lastActiveSeason'),
		sort: url.searchParams.get('sort') ?? undefined,
		dir: url.searchParams.get('dir') ?? undefined,
		page: url.searchParams.get('page') ?? undefined
	});

	if (!platform?.env?.DB) {
		return {
			members: buildEmptyMemberPayload({
				query: parsedQuery.q.trim(),
				sort: parsedQuery.sort,
				dir: parsedQuery.dir,
				sexFilter: parsedQuery.sex ?? null,
				roleFilter: parsedQuery.role ?? null,
				lastActiveSeasonId: parsedQuery.lastActiveSeason ?? null
			}),
			capabilities: {
				canAddMembers: false,
				canManageRoles: false,
				canRemoveMembers: false
			},
			activeSeasons: [],
			memberAssignableRoleOptions: getMemberAssignableRoleOptions(),
			memberId,
			error: 'Database is unavailable.'
		};
	}

	const clientId = requireAuthenticatedClientId(locals);
	const dbOps = getCentralDbOps(event);
	const activeSeasons = toActiveSeasonOptions(await dbOps.seasons.getByClientId(clientId));
	const shouldSearch = parsedQuery.q.trim().length >= 2;
	const memberResult = shouldSearch
		? await dbOps.members.searchByClient({
				clientId,
				query: parsedQuery.q.trim(),
				page: parsedQuery.page,
				sex: parsedQuery.sex ?? null,
				role: parsedQuery.role ?? null,
				lastActiveSeasonId: parsedQuery.lastActiveSeason ?? null,
				sort: parsedQuery.sort,
				dir: parsedQuery.dir
			})
		: buildEmptyMemberPayload({
				query: parsedQuery.q.trim(),
				sort: parsedQuery.sort,
				dir: parsedQuery.dir,
				sexFilter: parsedQuery.sex ?? null,
				roleFilter: parsedQuery.role ?? null,
				lastActiveSeasonId: parsedQuery.lastActiveSeason ?? null
			});

	locals.requestLogMeta = {
		table: 'users,user_clients',
		recordCount: memberResult.rows.length
	};

	const canAddMembers = requirePermission(locals, PERMISSIONS.ADD_MEMBER);
	const canManageRoles = requirePermission(locals, PERMISSIONS.CHANGE_MEMBER_ROLE);
	const canRemoveMembers = requirePermission(locals, PERMISSIONS.REMOVE_MEMBER);

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
			roleFilter: parsedQuery.role ?? null,
			lastActiveSeasonId: parsedQuery.lastActiveSeason ?? null
		},
		capabilities: {
			canAddMembers,
			canManageRoles,
			canRemoveMembers
		},
		activeSeasons,
		memberAssignableRoleOptions: getMemberAssignableRoleOptions(),
		memberId
	};
};
