import type { MemberRole, MemberSex, MemberSortKey, SortDirection } from '$lib/members/types.js';

type MemberRoleFilterOption = {
	value: '' | MemberRole;
	label: string;
};

type ResetMemberFilterState = {
	searchQuery: string;
	sexFilter: MemberSex | '';
	roleFilter: MemberRole | '';
	lastActiveSeasonId: string;
	sortKey: MemberSortKey;
	sortDir: SortDirection;
	currentPage: number;
};

const BASE_MEMBER_ROLE_FILTER_OPTIONS: MemberRoleFilterOption[] = [
	{ value: '', label: 'All Roles' },
	{ value: 'participant', label: 'Participant' },
	{ value: 'manager', label: 'Manager' },
	{ value: 'admin', label: 'Admin' }
];

export function buildMemberRoleFilterOptions(includeDeveloperRole: boolean): MemberRoleFilterOption[] {
	return includeDeveloperRole
		? [...BASE_MEMBER_ROLE_FILTER_OPTIONS, { value: 'dev', label: 'Developer' }]
		: [...BASE_MEMBER_ROLE_FILTER_OPTIONS];
}

export function getResetMemberFilterState(searchQuery: string): ResetMemberFilterState {
	return {
		searchQuery,
		sexFilter: '',
		roleFilter: '',
		lastActiveSeasonId: '',
		sortKey: 'lastName',
		sortDir: 'asc',
		currentPage: 1
	};
}
