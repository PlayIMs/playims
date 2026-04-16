import type { RequestEvent } from '@sveltejs/kit';
import type { Season } from '$lib/database';
import {
	DASHBOARD_NAV_ITEMS,
	canAccessDashboardRouteForPermissions,
	filterDashboardNavigationItemsForPermissions
} from '$lib/dashboard/navigation';
import { buildPermissionSnapshot } from '$lib/server/auth/permissions';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import { getCentralDbOps, getTenantDbOps } from '$lib/server/database/context';
import {
	buildFacilityAreaSearchHref,
	buildClubTeamSearchHref,
	buildMemberSearchHref,
	buildTeamSearchHref,
	groupSearchResults,
	scoreSearchCandidate
} from '$lib/search/utils.js';
import type { SearchCategory, SearchResponse, SearchResult } from '$lib/search/types.js';

type SearchEvent = Pick<RequestEvent, 'locals' | 'platform' | 'url'>;
type SearchSeasonRecord = Pick<Season, 'id' | 'name' | 'slug' | 'isCurrent' | 'isActive'>;

const SEARCH_CATEGORY_LIMIT = 40;
const SEARCH_RESULT_SEPARATOR = '\u2022';

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
		id: 'offline',
		resultKey: 'pages:/offline',
		category: 'pages' as const,
		title: 'Offline',
		subtitle: 'Offline support page',
		href: '/offline'
	}
] satisfies SearchResult[];

const DASHBOARD_SETTINGS_PAGE_RESULTS = [
	{
		id: 'settings-modules',
		resultKey: 'pages:/dashboard/settings/modules',
		category: 'pages' as const,
		title: 'Modules',
		subtitle: 'Settings page',
		meta: 'Dashboard settings navigation and modules',
		href: '/dashboard/settings/modules'
	},
	{
		id: 'settings-branding',
		resultKey: 'pages:/dashboard/settings/branding',
		category: 'pages' as const,
		title: 'Branding',
		subtitle: 'Settings page',
		meta: 'Organization branding and appearance settings',
		href: '/dashboard/settings/branding'
	},
	{
		id: 'settings-billing',
		resultKey: 'pages:/dashboard/settings/billing',
		category: 'pages' as const,
		title: 'Billing',
		subtitle: 'Settings page',
		meta: 'Billing and plan settings',
		href: '/dashboard/settings/billing'
	},
	{
		id: 'settings-notifications',
		resultKey: 'pages:/dashboard/settings/notifications',
		category: 'pages' as const,
		title: 'Notifications',
		subtitle: 'Settings page',
		meta: 'Notification preferences and alerts',
		href: '/dashboard/settings/notifications'
	},
	{
		id: 'settings-organization',
		resultKey: 'pages:/dashboard/settings/organization',
		category: 'pages' as const,
		title: 'Organization',
		subtitle: 'Settings page',
		meta: 'Organization profile and details settings',
		href: '/dashboard/settings/organization'
	},
	{
		id: 'settings-registrations',
		resultKey: 'pages:/dashboard/settings/registrations',
		category: 'pages' as const,
		title: 'Registrations',
		subtitle: 'Settings page',
		meta: 'Registration settings and defaults',
		href: '/dashboard/settings/registrations'
	}
] satisfies SearchResult[];

function isAuthenticatedSearch(event: SearchEvent): boolean {
	return Boolean(event.locals.user?.id && event.locals.session?.activeClientId);
}

function isActiveFlag(value: unknown): boolean {
	return value !== 0;
}

function buildDashboardPageResults(event: SearchEvent): SearchResult[] {
	if (!isAuthenticatedSearch(event)) return [];
	const effectiveRole = event.locals.user?.role ?? 'participant';
	const permissions = buildPermissionSnapshot(effectiveRole);
	const navigationResults = filterDashboardNavigationItemsForPermissions({
		items: DASHBOARD_NAV_ITEMS,
		permissions
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
	const settingsPageResults = DASHBOARD_SETTINGS_PAGE_RESULTS.filter((page) =>
		canAccessDashboardRouteForPermissions({
			pathname: page.href,
			permissions
		})
	);

	return [...navigationResults, ...settingsPageResults];
}

function scoreResult(query: string, result: SearchResult): number {
	return scoreSearchCandidate(query, [result.title, result.subtitle ?? '', result.meta ?? '']);
}

function normalizeRawSearchKey(value: string | null | undefined): string {
	return value?.trim().toLowerCase() ?? '';
}

function resolveScopedSeason(
	seasons: SearchSeasonRecord[],
	url: URL,
	queryParam = 'season'
): SearchSeasonRecord | null {
	const requestedSeason = normalizeRawSearchKey(url.searchParams.get(queryParam));
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

function matchesScopedSeasonRecord(
	record: {
		seasonId?: string | null;
		seasonName?: string | null;
	},
	scopedSeason: SearchSeasonRecord | null
): boolean {
	if (!scopedSeason) return true;
	if (normalizeRawSearchKey(record.seasonId) === normalizeRawSearchKey(scopedSeason.id))
		return true;
	return normalizeRawSearchKey(record.seasonName) === normalizeRawSearchKey(scopedSeason.name);
}

function searchablePageResults(event: SearchEvent): SearchResult[] {
	return isAuthenticatedSearch(event) ? buildDashboardPageResults(event) : [...PUBLIC_PAGE_RESULTS];
}

export async function getSearchResponse(
	event: SearchEvent,
	query: string
): Promise<SearchResponse> {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return await getSearchEmptyState(event);
	}

	const scored: Array<SearchResult & { score: number }> = searchablePageResults(event)
		.map((result) => ({ ...result, score: scoreResult(trimmedQuery, result) }))
		.filter((result) => result.score > 0);

	if (event.platform?.env?.DB && isAuthenticatedSearch(event)) {
		const clientId = requireAuthenticatedClientId(event.locals as App.Locals);
		const centralDbOps = getCentralDbOps(event);
		const tenantDbOps = await getTenantDbOps(event, clientId);
		const [members, seasons] = await Promise.all([
			centralDbOps.members.searchByClient({
				clientId,
				query: trimmedQuery,
				page: 1,
				sort: 'lastName',
				dir: 'asc'
			}),
			tenantDbOps.seasons.getByClientId(clientId)
		]);
		const scopedSeason = resolveScopedSeason(seasons, event.url);
		const [
			offerings,
			leagues,
			divisions,
			teams,
			facilities,
			facilityAreas,
			clubSeasons,
			clubs,
			clubLeagues,
			clubTeams
		] = await Promise.all([
			tenantDbOps.offerings.searchByClient({
				clientId,
				query: trimmedQuery,
				seasonId: scopedSeason?.id ?? null,
				limit: SEARCH_CATEGORY_LIMIT
			}),
			tenantDbOps.leagues.searchByClient({
				clientId,
				query: trimmedQuery,
				seasonId: scopedSeason?.id ?? null,
				seasonName: scopedSeason?.name ?? null,
				limit: SEARCH_CATEGORY_LIMIT
			}),
			tenantDbOps.divisions.searchByClient({
				clientId,
				query: trimmedQuery,
				seasonId: scopedSeason?.id ?? null,
				seasonName: scopedSeason?.name ?? null,
				limit: SEARCH_CATEGORY_LIMIT
			}),
			tenantDbOps.teams.searchByClient({
				clientId,
				query: trimmedQuery,
				seasonId: scopedSeason?.id ?? null,
				seasonName: scopedSeason?.name ?? null,
				limit: SEARCH_CATEGORY_LIMIT
			}),
			tenantDbOps.facilities.searchByClient({
				clientId,
				query: trimmedQuery,
				limit: SEARCH_CATEGORY_LIMIT
			}),
			tenantDbOps.facilityAreas.searchByClient({
				clientId,
				query: trimmedQuery,
				limit: SEARCH_CATEGORY_LIMIT
			}),
			tenantDbOps.clubSportsSeasons?.getByClientId
				? tenantDbOps.clubSportsSeasons.getByClientId(clientId)
				: Promise.resolve([]),
			tenantDbOps.clubSportsClubs?.getByClientId
				? tenantDbOps.clubSportsClubs.getByClientId(clientId)
				: Promise.resolve([]),
			tenantDbOps.clubSportsLeagues?.getByClientId
				? tenantDbOps.clubSportsLeagues.getByClientId(clientId)
				: Promise.resolve([]),
			tenantDbOps.clubSportsTeams?.getByClientId
				? tenantDbOps.clubSportsTeams.getByClientId(clientId)
				: Promise.resolve([])
		]);
		const scopedClubSeason = resolveScopedSeason(clubSeasons, event.url, 'clubSeason');
		const clubsById = new Map(
			clubs
				.filter((club): club is (typeof clubs)[number] & { id: string } => Boolean(club.id))
				.map((club) => [club.id, club])
		);
		const clubLeaguesById = new Map(
			clubLeagues
				.filter((clubLeague): clubLeague is (typeof clubLeagues)[number] & { id: string } =>
					Boolean(clubLeague.id)
				)
				.map((clubLeague) => [clubLeague.id, clubLeague])
		);
		const clubSeasonsById = new Map(
			clubSeasons
				.filter((clubSeason): clubSeason is (typeof clubSeasons)[number] & { id: string } =>
					Boolean(clubSeason.id)
				)
				.map((clubSeason) => [clubSeason.id, clubSeason])
		);

		for (const member of members.rows) {
			const result: SearchResult = {
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
			if (!season.id || !seasonSlug || season.id !== scopedSeason?.id) continue;
			const result: SearchResult = {
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

		for (const clubSeason of clubSeasons) {
			const seasonSlug = clubSeason.slug?.trim();
			if (!clubSeason.id || !seasonSlug || clubSeason.id !== scopedClubSeason?.id) continue;
			const result: SearchResult = {
				id: clubSeason.id,
				resultKey: `clubSeasons:${clubSeason.id}`,
				category: 'seasons',
				title: clubSeason.name?.trim() || 'Club Season',
				subtitle: 'Club season',
				href: `/dashboard/clubs?season=${encodeURIComponent(seasonSlug)}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const offering of offerings.filter(
			(offering) =>
				isActiveFlag(offering.isActive) && matchesScopedSeasonRecord(offering, scopedSeason)
		)) {
			const seasonSlug = offering.seasonSlug?.trim();
			const offeringSlug = offering.slug?.trim();
			if (!offering.id || !seasonSlug || !offeringSlug) continue;
			const result: SearchResult = {
				id: offering.id,
				resultKey: `offerings:${offering.id}`,
				category: 'offerings',
				title: offering.name?.trim() || 'Offering',
				subtitle: 'Offering',
				meta: offering.seasonName?.trim() || null,
				href: `/dashboard/offerings/${seasonSlug}/${offeringSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const league of leagues.filter(
			(league) =>
				isActiveFlag((league as { isActive?: number }).isActive ?? 1) &&
				matchesScopedSeasonRecord(league, scopedSeason)
		)) {
			const seasonSlug = league.seasonSlug?.trim();
			const offeringSlug = league.offeringSlug?.trim();
			const leagueSlug = league.slug?.trim();
			if (!league.id || !seasonSlug || !offeringSlug || !leagueSlug) continue;
			const result: SearchResult = {
				id: league.id,
				resultKey: `leagues:${league.id}`,
				category: 'leagues',
				title: league.name?.trim() || 'League',
				subtitle: league.offeringName?.trim() || null,
				meta: league.seasonName?.trim() || null,
				href: `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const division of divisions.filter(
			(division) =>
				isActiveFlag(division.isActive) && matchesScopedSeasonRecord(division, scopedSeason)
		)) {
			const seasonSlug = division.seasonSlug?.trim();
			const offeringSlug = division.offeringSlug?.trim();
			const leagueSlug = division.leagueSlug?.trim();
			const divisionSlug = division.slug?.trim() || division.id?.trim();
			if (!division.id || !seasonSlug || !offeringSlug || !leagueSlug || !divisionSlug) continue;
			const result: SearchResult = {
				id: division.id,
				resultKey: `divisions:${division.id}`,
				category: 'divisions',
				title: division.name?.trim() || 'Division',
				subtitle: division.leagueName?.trim() || null,
				meta:
					[division.offeringName?.trim(), division.seasonName?.trim()].filter(Boolean).join(' ') ||
					null,
				href: `/dashboard/offerings/${seasonSlug}/${offeringSlug}/${leagueSlug}/${divisionSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const team of teams.filter(
			(team) => isActiveFlag(team.isActive) && matchesScopedSeasonRecord(team, scopedSeason)
		)) {
			const seasonSlug = team.seasonSlug?.trim();
			const offeringSlug = team.offeringSlug?.trim();
			const leagueSlug = team.leagueSlug?.trim();
			const divisionSlug = team.divisionSlug?.trim() || team.divisionId?.trim();
			const teamSlug = team.slug?.trim() || team.id?.trim();
			if (!team.id || !seasonSlug || !offeringSlug || !leagueSlug || !divisionSlug || !teamSlug)
				continue;
			const result: SearchResult = {
				id: team.id,
				resultKey: `teams:${team.id}`,
				category: 'teams',
				title: team.name?.trim() || 'Team',
				subtitle:
					[team.offeringName?.trim(), team.leagueName?.trim(), team.divisionName?.trim()]
						.filter(Boolean)
						.join(` ${SEARCH_RESULT_SEPARATOR} `) || null,
				meta:
					[team.offeringName?.trim(), team.seasonName?.trim()].filter(Boolean).join(' ') || null,
				href: buildTeamSearchHref({
					seasonSlug,
					offeringSlug,
					leagueSlug,
					divisionSlug,
					teamSlug
				})
			};
			const baseScore = scoreResult(trimmedQuery, result);
			// slight team boost ensures team-name queries prioritize direct team routes over parent records.
			const score = baseScore > 0 ? baseScore + 25 : 0;
			if (score > 0) scored.push({ ...result, score });
		}

		for (const club of clubs.filter(
			(club) =>
				isActiveFlag(club.isActive) &&
				(!scopedClubSeason ||
					normalizeRawSearchKey(club.clubSeasonId) === normalizeRawSearchKey(scopedClubSeason.id))
		)) {
			const clubSeason = clubSeasonsById.get(club.clubSeasonId ?? '');
			const seasonSlug = clubSeason?.slug?.trim();
			const clubSlug = club.slug?.trim();
			if (!club.id || !seasonSlug || !clubSlug) continue;
			const result: SearchResult = {
				id: club.id,
				resultKey: `clubs:${club.id}`,
				category: 'clubs',
				title: club.name?.trim() || 'Club',
				subtitle: club.sport?.trim() || 'Club sport',
				meta: clubSeason?.name?.trim() || null,
				href: `/dashboard/clubs/${seasonSlug}/${clubSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const clubLeague of clubLeagues.filter((clubLeague) =>
			isActiveFlag(clubLeague.isActive)
		)) {
			const club = clubsById.get(clubLeague.clubId ?? '');
			const clubSeason = clubSeasonsById.get(clubLeague.clubSeasonId ?? '');
			const seasonSlug = clubSeason?.slug?.trim();
			const clubSlug = club?.slug?.trim();
			const leagueSlug = clubLeague.slug?.trim();
			if (!clubLeague.id || !seasonSlug || !clubSlug || !leagueSlug) continue;
			if (
				scopedClubSeason &&
				normalizeRawSearchKey(clubLeague.clubSeasonId) !==
					normalizeRawSearchKey(scopedClubSeason.id)
			) {
				continue;
			}
			const result: SearchResult = {
				id: clubLeague.id,
				resultKey: `clubLeagues:${clubLeague.id}`,
				category: 'leagues',
				title: clubLeague.name?.trim() || 'League',
				subtitle: club?.name?.trim() || 'Club',
				meta: clubSeason?.name?.trim() || null,
				href: `/dashboard/clubs/${seasonSlug}/${clubSlug}/${leagueSlug}`
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		for (const clubTeam of clubTeams.filter((clubTeam) => isActiveFlag(clubTeam.isActive))) {
			const club = clubsById.get(clubTeam.clubId ?? '');
			const clubLeague = clubLeaguesById.get(clubTeam.clubLeagueId ?? '');
			const clubSeason = clubSeasonsById.get(clubTeam.clubSeasonId ?? '');
			const seasonSlug = clubSeason?.slug?.trim();
			const clubSlug = club?.slug?.trim();
			const leagueSlug = clubLeague?.slug?.trim();
			const teamSlug = clubTeam.slug?.trim();
			if (!clubTeam.id || !seasonSlug || !clubSlug || !leagueSlug || !teamSlug) continue;
			if (
				scopedClubSeason &&
				normalizeRawSearchKey(clubTeam.clubSeasonId) !== normalizeRawSearchKey(scopedClubSeason.id)
			) {
				continue;
			}
			const result: SearchResult = {
				id: clubTeam.id,
				resultKey: `clubTeams:${clubTeam.id}`,
				category: 'teams',
				title: clubTeam.name?.trim() || 'Team',
				subtitle:
					[club?.name?.trim(), clubLeague?.name?.trim()].filter(Boolean).join(' - ') || null,
				meta: clubSeason?.name?.trim() || null,
				href: buildClubTeamSearchHref({
					seasonSlug,
					clubSlug,
					leagueSlug,
					teamSlug
				})
			};
			const baseScore = scoreResult(trimmedQuery, result);
			const score = baseScore > 0 ? baseScore + 25 : 0;
			if (score > 0) scored.push({ ...result, score });
		}

		for (const facility of facilities.filter((facility) => isActiveFlag(facility.isActive))) {
			const result: SearchResult = {
				id: facility.id,
				resultKey: `facilities:${facility.id}`,
				category: 'facilities',
				title: facility.name?.trim() || 'Facility',
				subtitle: facility.slug?.trim() || null,
				href: facility.slug?.trim()
					? `/dashboard/facilities?facility=${encodeURIComponent(facility.slug.trim())}`
					: '/dashboard/facilities'
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}

		const facilitySlugById = new Map(
			facilities.map((facility) => [facility.id, facility.slug?.trim() || ''])
		);

		for (const area of facilityAreas.filter((facilityArea) =>
			isActiveFlag(facilityArea.isActive)
		)) {
			if (!area.id || !area.facilityId) continue;
			const facilitySlug = facilitySlugById.get(area.facilityId) ?? '';
			const areaSlug = area.slug?.trim() || '';
			const result: SearchResult = {
				id: area.id,
				resultKey: `facilityAreas:${area.id}`,
				category: 'facilityAreas',
				title: area.name?.trim() || 'Facility Area',
				subtitle: area.facilityName?.trim() || null,
				href:
					facilitySlug && areaSlug
						? buildFacilityAreaSearchHref({
								facilitySlug,
								facilityAreaSlug: areaSlug
							})
						: '/dashboard/facilities'
			};
			const score = scoreResult(trimmedQuery, result);
			if (score > 0) scored.push({ ...result, score });
		}
	}

	const grouped = groupSearchResults(scored, {
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

export async function getSearchEmptyState(event: SearchEvent): Promise<SearchResponse> {
	const groups: { category: SearchCategory; label: string; items: SearchResult[] }[] = [];

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
				items: recents.slice(0, 8).map((entry) => ({
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

	return {
		success: true,
		query: '',
		groups,
		totalCount: groups.reduce((sum, group) => sum + group.items.length, 0)
	};
}
