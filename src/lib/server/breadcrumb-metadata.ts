import type { BreadcrumbMetadata } from '$lib/components/navigation/breadcrumb';
import { leagueMatchesSeason, offeringMatchesSeason } from './intramural-offering-scope';
import type { League, Offering, Season } from '$lib/database';

type OfferingInput = Pick<Offering, 'id' | 'slug' | 'seasonId'>;
type LeagueInput = Pick<League, 'id' | 'slug' | 'offeringId' | 'seasonId'> & Partial<League>;
type DivisionInput = {
	id: string;
	leagueId: string | null;
	slug: string | null;
	isLocked: number | null;
	maxTeams?: number | null;
};
interface CountDatabase {
	divisions: { getByLeagueIds(ids: string[]): Promise<DivisionInput[]> };
	teams: {
		getByClientIdAndDivisionIds(
			clientId: string,
			ids: string[]
		): Promise<
			Array<{
				divisionId: string;
				teamStatus: string;
			}>
		>;
	};
}

export async function loadBreadcrumbMetadata(
	db: CountDatabase,
	clientId: string,
	season: Pick<Season, 'id' | 'name' | 'slug'>,
	offerings: OfferingInput[],
	leagues: LeagueInput[]
): Promise<Record<string, BreadcrumbMetadata>> {
	const scopedOfferings = offerings.filter((offering) =>
		offeringMatchesSeason(offering as Offering, season as Season, leagues as League[])
	);
	const scopedLeagues = leagues.filter(
		(league) =>
			leagueMatchesSeason(league as League, season as Season) &&
			scopedOfferings.some((offering) => offering.id === league.offeringId)
	);
	const divisions = await db.divisions.getByLeagueIds(scopedLeagues.map((league) => league.id));
	const teams = await db.teams.getByClientIdAndDivisionIds(
		clientId,
		divisions.map((division) => division.id)
	);
	const counts = new Map<string, { teamCount: number; waitlistCount: number }>();
	for (const team of teams) {
		const count = counts.get(team.divisionId) ?? { teamCount: 0, waitlistCount: 0 };
		const status = team.teamStatus.trim().toLowerCase();
		if (status === 'active') count.teamCount += 1;
		if (status === 'waitlist' || status === 'waitlisted') count.waitlistCount += 1;
		counts.set(team.divisionId, count);
	}
	const result: Record<string, BreadcrumbMetadata> = {};
	for (const offering of scopedOfferings) {
		const offeringHref = `/dashboard/offerings/${season.slug}/${offering.slug?.trim() || offering.id}`;
		const offeringLeagues = scopedLeagues.filter((league) => league.offeringId === offering.id);
		let offeringTeamCount = 0;
		for (const league of offeringLeagues) {
			const leagueHref = `${offeringHref}/${league.slug?.trim() || league.id}`;
			const leagueDivisions = divisions.filter((division) => division.leagueId === league.id);
			let teamCount = 0;
			for (const division of leagueDivisions) {
				const count = counts.get(division.id) ?? { teamCount: 0, waitlistCount: 0 };
				result[`${leagueHref}/${division.slug?.trim() || division.id}`] = {
					...count,
					maxTeams: division.maxTeams,
					isLocked: division.isLocked === 1
				};
				teamCount += count.teamCount;
			}
			result[leagueHref] = {
				unlockedCount: leagueDivisions.filter((division) => division.isLocked !== 1).length,
				lockedCount: leagueDivisions.filter((division) => division.isLocked === 1).length,
				teamCount
			};
			offeringTeamCount += teamCount;
		}
		result[offeringHref] = { leagueCount: offeringLeagues.length, teamCount: offeringTeamCount };
	}
	return result;
}
