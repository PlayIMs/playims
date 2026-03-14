import type { RequestEvent } from '@sveltejs/kit';
import type { League, Offering, Season } from '$lib/database';
import {
	DASHBOARD_NAV_ITEMS,
	filterDashboardNavigationItemsForAuthMode
} from '$lib/dashboard/navigation';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import { leagueMatchesSeason } from '$lib/server/intramural-offering-scope';
import {
	buildFacilityAreaSearchHref,
	buildMemberSearchHref,
	buildTeamSearchHref,
	groupMegaSearchResults,
	scoreMegaSearchCandidate
} from '$lib/search/utils.js';
import type {
	MegaSearchCategory,
	MegaSearchResponse,
	MegaSearchResult
} from '$lib/search/types.js';

type SearchEvent = Pick<RequestEvent, 'locals' | 'platform' | 'url'>;
type SearchSeasonRecord = Season;

const PUBLIC_PAGE_RESULTS = [
	{
		id: 'home',
		resultKey: 'pages:/',
		category: 'pages' as const,
		title: 'Home',
		subtitle: 'Public landing page',
		href: '/'
	},
	{
		id: 'log-in',
		resultKey: 'pages:/log-in',
		category: 'pages' as const,
		title: 'Log In',
		subtitle: 'Access your account',
		href: '/log-in'
	},
	{
		id: 'register',
		resultKey: 'pages:/register',
		category: 'pages' as const,
		title: 'Register',
		subtitle: 'Create a new account',
		href: '/register'
	},
	{
		id: 'offline',
		resultKey: 'pages:/offline',
		category: 'pages' as const,
		title: 'Offline',
		subtitle: 'Offline support page',
		href: '/offline'
	}
] satisfies MegaSearchResult[];

const SHORTCUT_RESULTS = [
	{
		id: 'shortcut-dashboard',
		resultKey: 'shortcuts:/dashboard',
		category: 'shortcuts' as const,
		title: 'Dashboard',
		subtitle: 'Open the dashboard home',
		href: '/dashboard',
		badge: 'Shortcut'
	},
	{
		id: 'shortcut-offerings',
		resultKey: 'shortcuts:/dashboard/offerings',
		category: 'shortcuts' as const,
		title: 'Offerings',
		subtitle: 'Manage seasons, offerings, leagues, and divisions',
		href: '/dashboard/offerings',
		badge: 'Shortcut'
	},
	{
		id: 'shortcut-members',
		resultKey: 'shortcuts:/dashboard/members',
		category: 'shortcuts' as const,
		title: 'Members',
		subtitle: 'Search and manage members',
		href: '/dashboard/members',
		badge: 'Shortcut'
	},
	{
		id: 'shortcut-facilities',
		resultKey: 'shortcuts:/dashboard/facilities',
		category: 'shortcuts' as const,
		title: 'Facilities',
		subtitle: 'Manage facilities and areas',
		href: '/dashboard/facilities',
		badge: 'Shortcut'
	}
] satisfies MegaSearchResult[];

function isAuthenticatedSearch(event: SearchEvent): boolean {
	return Boolean(event.locals.user?.id && event.locals.session?.activeClientId);
}

function isActiveFlag(value: unknown): boolean {
	return value !== 0;
}

function buildDashboardPageResults(event: SearchEvent): MegaSearchResult[] {
	if (!isAuthenticatedSearch(event)) return [];
	const effectiveRole = event.locals.user?.role ?? 'participant';
	const isViewingAsRole = Boolean(event.locals.user?.isViewingAsRole);
	return filterDashboardNavigationItemsForAuthMode({
		items: DASHBOARD_NAV_ITEMS,
		effectiveRole,
		isViewingAsRole
	})
		.filter((item) => item.href !== '#')
		.map((item) => ({
			id: item.key,
			resultKey: `pages:${item.href}`,
			category: 'pages' as const,
			title: item.defaultLabel,
			subtitle: 'Dashboard page',
			href: item.href
		}));
}

function scoreResult(query: string, result: MegaSearchResult): number {
	return scoreMegaSearchCandidate(query, [result.title, result.subtitle ?? '', result.meta ?? '']);
}

function normalizeRawSearchKey(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? '';
}

function resolveScopedSeason(seasons: SearchSeasonRecord[], url: URL): SearchSeasonRecord | null {
	const requestedSeason = normalizeRawSearchKey(url.searchParams.get('season'));
	const searchableSeasons = seasons.filter(
		(season): season is SearchSeasonRecord & { id: string } => Boolean(season.id)
	);

	if (requestedSeason) {
		const matchedSeason = searchableSeasons.find((season) => {
			const seasonId = normalizeRawSearchKey(season.id);
			const seasonSlug = normalizeRawSearchKey(season.slug);
			return seasonId === requestedSeason || seasonSlug === requestedSeason;
		});
		if (matchedSeason) return matchedSeason;
	}

	return (
		searchableSeasons.find((season) => season.isCurrent === 1) ??
		searchableSeasons.find((season) => season.isActive === 1) ??
		searchableSeasons[0] ??
		null
	);
}

function offeringMatchesScopedSeason(
	offering: Offering,
	scopedSeason: SearchSeasonRecord | null,
	leagues: League[]
): boolean {
	if (!scopedSeason) return true;
	if (offering.seasonId === scopedSeason.id) return true;
	if (!offering.id) return false;
	return leagues.some(
		(league) => league.offeringId === offering.id && leagueMatchesSeason(league, scopedSeason)
	);
}

function searchablePageResults(event: SearchEvent): MegaSearchResult[] {
	return [...PUBLIC_PAGE_RESULTS, ...buildDashboardPageResults(event)];
}

export async function getMegaSearchResponse(
	event: SearchEvent,
	query: string
): Promise<MegaSearchResponse> {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return await getMegaSearchEmptyState(event);
	}

	const scored: Array<MegaSearchResult & { score: number }> = searchablePageResults(event)
		.map((result) => ({ ...result, score: scoreResult(trimmedQuery, result) }))
		.filter((result) => result.score > 0);

	if (event.platform?.env?.DB && isAuthenticatedSearch(event)) {
		const clientId = requireAuthenticatedClientId(event.locals as App.Locals);
		const centralDbOps = getCentralDbOps(event);
		const tenantDbOps = await getTenantDbOps(event, clientId);
		const [members, seasons, offerings, leagues, facilities, facilityAreas, teams] =
			await Promise.all([
				centralDbOps.members.searchByClient({
					clientId,
					query: trimmedQuery,
					page: 1,
					sort: 'lastName',
					dir: 'asc'
				}),
				tenantDbOps.seasons.getByClientId(clientId),
				tenantDbOps.offerings.getByClientId(clientId),
				tenantDbOps.leagues.getByClientId(clientId),
				tenantDbOps.facilities.getAll(clientId),
				tenantDbOps.facilityAreas.getAll(clientId),
				tenantDbOps.teams.getByClientId(clientId)
			]);
		const leagueIds = leagues
			.map((league) => league.id)
			.filter((leagueId): leagueId is string => Boolean(leagueId));
		const divisions = await tenantDbOps.divisions.getByLeagueIds(leagueIds);
		const scopedSeason = resolveScopedSeason(seasons, event.url);
		const scopedSeasonId = scopedSeason?.id ?? null;
		const seasonById = new Map(
			seasons.filter((season) => Boolean(season.id)).map((season) => [season.id as string, season])
		);
		const offeringById = new Map(
			offerings
				.filter((offering) => Boolean(offering.id))
				.map((offering) => [offering.id as string, offering])
		);
		const leagueById = new Map(
			leagues.filter((league) => Boolean(league.id)).map((league) => [league.id as string, league])
		);
		const divisionById = new Map(
			divisions
				.filter((division) => Boolean(division.id))
				.map((division) => [division.id as string, division])
		);

		for (const member of members.rows) {
			const result: MegaSearchResult = {
				id: member.membershipId,
				resultKey: `members:${member.membershipId}`,
				category: 'members',
				title: member.fullName,
				subtitle: member.email ?? null,
				href: buildMemberSearchHref({
					membershipId: member.membershipId,
					fullName: member.fullName
				})
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const season of seasons) {
			const seasonSlug = season.slug?.trim();
			if (!season.id || !seasonSlug || season.id !== scopedSeasonId) continue;
			const result: MegaSearchResult = {
				id: season.id,
				resultKey: `seasons:${season.id}`,
				category: 'seasons',
				title: season.name?.trim() || 'Season',
				subtitle: 'Selected season',
				href: `/dashboard/offerings?season=${encodeURIComponent(seasonSlug)}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const offering of offerings.filter(
			(offering) =>
				isActiveFlag(offering.isActive) &&
				offeringMatchesScopedSeason(offering, scopedSeason, leagues)
		)) {
			const season = offering.seasonId
				? (seasonById.get(offering.seasonId) ?? scopedSeason)
				: scopedSeason;
			const seasonSlug = season?.slug?.trim();
			const offeringSlug = offering.slug?.trim();
			if (!offering.id || !seasonSlug || !offeringSlug) continue;
			const result: MegaSearchResult = {
				id: offering.id,
				resultKey: `offerings:${offering.id}`,
				category: 'offerings',
				title: offering.name?.trim() || 'Offering',
				subtitle: 'Offering',
				meta: season?.name?.trim() || null,
				href: `/dashboard/offerings/${seasonSlug}/${offeringSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const league of leagues.filter(
			(league) =>
				isActiveFlag((league as { isActive?: number }).isActive ?? 1) &&
				(!scopedSeason || leagueMatchesSeason(league, scopedSeason))
		)) {
			const offering = league.offeringId ? offeringById.get(league.offeringId) : null;
			const season = league.seasonId
				? (seasonById.get(league.seasonId) ?? scopedSeason)
				: scopedSeason;
			const seasonSlug = season?.slug?.trim();
			const offeringSlug = offering?.slug?.trim();
			const leagueSlug = league.slug?.trim();
			if (!league.id || !seasonSlug || !offeringSlug || !leagueSlug) continue;
			const result: MegaSearchResult = {
				id: league.id,
				resultKey: `leagues:${league.id}`,
				category: 'leagues',
				title: league.name?.trim() || 'League',
				subtitle: offering?.name?.trim() || null,
				meta: season?.name?.trim() || null,
				href: `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const division of divisions.filter((division) => {
			if (!isActiveFlag(division.isActive)) return false;
			const league = division.leagueId ? leagueById.get(division.leagueId) : null;
			return !scopedSeason || Boolean(league && leagueMatchesSeason(league, scopedSeason));
		})) {
			const league = division.leagueId ? leagueById.get(division.leagueId) : null;
			const offering = league?.offeringId ? offeringById.get(league.offeringId) : null;
			const season = league?.seasonId
				? (seasonById.get(league.seasonId) ?? scopedSeason)
				: scopedSeason;
			const seasonSlug = season?.slug?.trim();
			const offeringSlug = offering?.slug?.trim();
			const leagueSlug = league?.slug?.trim();
			const divisionSlug = division.slug?.trim() || division.id?.trim();
			if (!division.id || !seasonSlug || !offeringSlug || !leagueSlug || !divisionSlug) continue;
			const result: MegaSearchResult = {
				id: division.id,
				resultKey: `divisions:${division.id}`,
				category: 'divisions',
				title: division.name?.trim() || 'Division',
				subtitle: league?.name?.trim() || null,
				meta: [offering?.name?.trim(), season?.name?.trim()].filter(Boolean).join(' ') || null,
				href: `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}/${divisionSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const team of teams.filter((team) => {
			if (!isActiveFlag(team.isActive)) return false;
			const division = team.divisionId ? divisionById.get(team.divisionId) : null;
			const league = division?.leagueId ? leagueById.get(division.leagueId) : null;
			return !scopedSeason || Boolean(league && leagueMatchesSeason(league, scopedSeason));
		})) {
			const division = team.divisionId ? divisionById.get(team.divisionId) : null;
			const league = division?.leagueId ? leagueById.get(division.leagueId) : null;
			const offering = league?.offeringId ? offeringById.get(league.offeringId) : null;
			const season = league?.seasonId
				? (seasonById.get(league.seasonId) ?? scopedSeason)
				: scopedSeason;
			const seasonSlug = season?.slug?.trim();
			const offeringSlug = offering?.slug?.trim();
			const leagueSlug = league?.slug?.trim();
			if (!team.id || !seasonSlug || !offeringSlug || !leagueSlug) continue;
			const result: MegaSearchResult = {
				id: team.id,
				resultKey: `teams:${team.id}`,
				category: 'teams',
				title: team.name?.trim() || 'Team',
				subtitle: division?.name?.trim() || league?.name?.trim() || null,
				meta: [offering?.name?.trim(), season?.name?.trim()].filter(Boolean).join(' ') || null,
				href: buildTeamSearchHref({
					seasonSlug,
					offeringSlug,
					leagueSlug,
					teamId: team.id
				})
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const facility of facilities.filter((facility) => isActiveFlag(facility.isActive))) {
			const result: MegaSearchResult = {
				id: facility.id,
				resultKey: `facilities:${facility.id}`,
				category: 'facilities',
				title: facility.name?.trim() || 'Facility',
				subtitle: facility.slug?.trim() || null,
				href: `/dashboard/facilities?facilityId=${encodeURIComponent(facility.id)}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const area of facilityAreas.filter((facilityArea) =>
			isActiveFlag(facilityArea.isActive)
		)) {
			if (!area.id || !area.facilityId) continue;
			const facility = facilities.find((entry) => entry.id === area.facilityId);
			const result: MegaSearchResult = {
				id: area.id,
				resultKey: `facilityAreas:${area.id}`,
				category: 'facilityAreas',
				title: area.name?.trim() || 'Facility Area',
				subtitle: facility?.name?.trim() || null,
				href: buildFacilityAreaSearchHref({
					facilityId: area.facilityId,
					facilityAreaId: area.id
				})
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}
	}

	const grouped = groupMegaSearchResults(scored, {
		perCategoryLimit: 5,
		totalLimit: 25
	});

	return {
		success: true,
		query: trimmedQuery,
		groups: grouped.groups,
		totalCount: grouped.totalCount
	};
}

export async function getMegaSearchEmptyState(event: SearchEvent): Promise<MegaSearchResponse> {
	const groups: { category: MegaSearchCategory; label: string; items: MegaSearchResult[] }[] = [];

	if (event.platform?.env?.DB && isAuthenticatedSearch(event)) {
		const centralDbOps = getCentralDbOps(event);
		const clientId = requireAuthenticatedClientId(event.locals as App.Locals);
		const recents = await centralDbOps.searchRecents.listByUserAndClient(
			event.locals.user!.id,
			clientId
		);
		if (recents.length > 0) {
			groups.push({
				category: 'recent',
				label: 'Recent',
				items: recents.map((entry) => ({
					id: entry.id,
					resultKey: entry.resultKey,
					category: 'recent',
					title: entry.title,
					subtitle: entry.subtitle ?? null,
					href: entry.href,
					badge: entry.badge ?? 'Recent',
					meta: entry.meta ?? null
				}))
			});
		}
	}

	const shortcuts = isAuthenticatedSearch(event)
		? SHORTCUT_RESULTS.filter((shortcut) =>
				shortcut.href === '/dashboard'
					? true
					: buildDashboardPageResults(event).some((page) => page.href === shortcut.href)
			)
		: SHORTCUT_RESULTS.filter((shortcut) => shortcut.href === '/dashboard').map((shortcut) => ({
				...shortcut,
				href: '/log-in'
			}));

	groups.push({
		category: 'shortcuts',
		label: 'Shortcuts',
		items: shortcuts
	});

	return {
		success: true,
		query: '',
		groups,
		totalCount: groups.reduce((sum, group) => sum + group.items.length, 0)
	};
}
