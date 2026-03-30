import type { MemberRole, MemberSex, MemberSortKey, SortDirection } from '$lib/members/types.js';

interface MembersUrlStateInput {
	searchQuery: string;
	sexFilter: MemberSex | '';
	roleFilter: MemberRole | '';
	lastActiveSeasonId: string;
	sortKey: MemberSortKey;
	sortDir: SortDirection;
	currentPage: number;
}

export function syncMembersUrlIfReady(input: {
	href: string;
	ready: boolean;
	replace: (href: string) => void;
	state: MembersUrlStateInput;
}): void {
	if (!input.ready) return;

	const url = new URL(input.href);
	const trimmedQuery = input.state.searchQuery.trim();
	if (trimmedQuery) url.searchParams.set('q', trimmedQuery);
	else url.searchParams.delete('q');
	if (input.state.sexFilter) url.searchParams.set('sex', input.state.sexFilter);
	else url.searchParams.delete('sex');
	if (input.state.roleFilter) url.searchParams.set('role', input.state.roleFilter);
	else url.searchParams.delete('role');
	if (input.state.lastActiveSeasonId) {
		url.searchParams.set('lastActiveSeason', input.state.lastActiveSeasonId);
	} else url.searchParams.delete('lastActiveSeason');
	if (input.state.sortKey !== 'lastName') url.searchParams.set('sort', input.state.sortKey);
	else url.searchParams.delete('sort');
	if (input.state.sortDir !== 'asc') url.searchParams.set('dir', input.state.sortDir);
	else url.searchParams.delete('dir');
	if (input.state.currentPage > 1) url.searchParams.set('page', String(input.state.currentPage));
	else url.searchParams.delete('page');

	const nextHref = `${url.pathname}${url.search}${url.hash}`;
	const currentUrl = new URL(input.href);
	const currentHref = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
	if (nextHref === currentHref) return;

	input.replace(nextHref);
}

export function clearMemberSelectionFromHref(href: string): string {
	const url = new URL(href);
	url.searchParams.delete('memberId');
	return `${url.pathname}${url.search}${url.hash}`;
}
