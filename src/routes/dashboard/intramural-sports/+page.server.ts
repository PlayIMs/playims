import { DatabaseOperations } from '$lib/database';
import { requireAuthenticatedClientId } from '$lib/server/client-context';
import type { Division } from '$lib/database/schema/divisions';
import type { League } from '$lib/database/schema/leagues';
import type { Offering } from '$lib/database/schema/offerings';
import type { PageServerLoad } from './$types';

type ActivityType = 'league' | 'tournament';

interface ActivityCard {
	id: string;
	offeringId: string | null;
	leagueId: string | null;
	stackOrder: number | null;
	offeringType: ActivityType;
	offeringName: string;
	leagueName: string;
	seasonLabel: string;
	season: string | null;
	year: number | null;
	gender: string | null;
	skillLevel: string | null;
	registrationStart: string | null;
	registrationEnd: string | null;
	seasonStart: string | null;
	seasonEnd: string | null;
	divisionCount: number;
	spotsRemaining: number | null;
	isLocked: boolean;
	isActive: boolean;
}

function toActivityType(value: string | null | undefined): ActivityType {
	const normalized = value?.trim().toLowerCase();
	if (normalized === 'tournament') return 'tournament';
	return 'league';
}

function formatSeasonLabel(league: League): string {
	const season = league.season?.trim() ?? '';
	const year = league.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year}`;
	return 'Unscheduled';
}

function createDivisionCountByLeague(
	divisions: Division[],
	leagueIds: Set<string>
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const division of divisions) {
		if (!division.leagueId || !leagueIds.has(division.leagueId)) continue;
		counts.set(division.leagueId, (counts.get(division.leagueId) ?? 0) + 1);
	}
	return counts;
}

export const load: PageServerLoad = async ({ platform, locals }) => {
	const setRequestLogMeta = (recordCount: number) => {
		locals.requestLogMeta = {
			table: 'offerings,leagues,divisions',
			recordCount: Math.max(0, recordCount)
		};
	};

	if (!platform?.env?.DB) {
		setRequestLogMeta(0);
		return {
			activities: [] as ActivityCard[],
			error: 'Database not configured'
		};
	}

	const db = new DatabaseOperations(platform);
	const clientId = requireAuthenticatedClientId(locals);

	try {
		const [offerings, leagues] = await Promise.all([
			db.offerings.getByClientId(clientId),
			db.leagues.getByClientId(clientId)
		]);
		const leagueIds = leagues
			.map((league) => league.id)
			.filter((leagueId): leagueId is string => Boolean(leagueId));
		const divisions = await db.divisions.getByLeagueIds(leagueIds);
		setRequestLogMeta(offerings.length + leagues.length + divisions.length);

		const leagueIdSet = new Set(leagueIds);
		const divisionCountByLeague = createDivisionCountByLeague(divisions, leagueIdSet);
		const offeringsById = new Map(
			offerings
				.filter((offering): offering is Offering & { id: string } => Boolean(offering.id))
				.map((offering) => [offering.id, offering])
		);

		const activities = leagues
			.map<ActivityCard>((league, index) => {
				const resolvedId = league.id ?? `league-${index + 1}`;
				const offering = league.offeringId ? offeringsById.get(league.offeringId) : undefined;
				const offeringName = offering?.name?.trim() || 'General Recreation';
				const offeringType = toActivityType(offering?.type);

				const divisionCount = league.id ? (divisionCountByLeague.get(league.id) ?? 0) : 0;

				return {
					id: resolvedId,
					offeringId: league.offeringId ?? null,
					leagueId: league.id ?? null,
					stackOrder: league.stackOrder ?? null,
					offeringType,
					offeringName,
					leagueName: league.name?.trim() || 'Untitled League',
					seasonLabel: formatSeasonLabel(league),
					season: league.season ?? null,
					year: league.year ?? null,
					gender: league.gender ?? null,
					skillLevel: league.skillLevel ?? null,
					registrationStart: league.regStartDate ?? null,
					registrationEnd: league.regEndDate ?? null,
					seasonStart: league.seasonStartDate ?? null,
					seasonEnd: league.seasonEndDate ?? null,
					divisionCount,
					spotsRemaining: null,
					isLocked: league.isLocked === 1,
					isActive: league.isActive !== 0
				};
			})
			.sort((a, b) => {
				const nameDiff = a.offeringName.localeCompare(b.offeringName);
				if (nameDiff !== 0) return nameDiff;
				const aStackOrder = a.stackOrder ?? Number.MAX_SAFE_INTEGER;
				const bStackOrder = b.stackOrder ?? Number.MAX_SAFE_INTEGER;
				if (aStackOrder !== bStackOrder) return aStackOrder - bStackOrder;
				return a.leagueName.localeCompare(b.leagueName);
			});

		return {
			activities
		};
	} catch (error) {
		setRequestLogMeta(0);
		console.error('Failed to load intramural offerings page:', error);
		return {
			activities: [] as ActivityCard[],
			error: 'Unable to load intramural offerings right now'
		};
	}
};
