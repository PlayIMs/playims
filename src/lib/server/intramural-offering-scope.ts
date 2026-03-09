import type { DatabaseOperations, League, Offering, Season } from '$lib/database';

export const normalizeIntramuralText = (value: string | null | undefined): string =>
	value?.trim().toLowerCase() ?? '';

export const normalizeIntramuralSlug = (value: string | null | undefined): string => {
	if (!value) return '';
	return value
		.toLowerCase()
		.trim()
		.replace(/['"]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
};

export const formatLegacySeasonLabel = (league: League): string => {
	const season = league.season?.trim() ?? '';
	const year = league.year ?? null;
	if (season && year) return `${season} ${year}`;
	if (season) return season;
	if (year) return `${year}`;
	return '';
};

export const leagueMatchesSeason = (league: League, season: Season): boolean => {
	if (league.seasonId) {
		return league.seasonId === season.id;
	}

	return normalizeIntramuralText(formatLegacySeasonLabel(league)) === normalizeIntramuralText(season.name);
};

export const buildLegacyLeagueSlug = (
	leagueName: string | null | undefined,
	offeringSlug: string | null | undefined
): string => {
	const normalizedLeagueSlug = normalizeIntramuralSlug(leagueName);
	const normalizedOfferingSlug = normalizeIntramuralSlug(offeringSlug);
	if (!normalizedLeagueSlug) return '';
	if (!normalizedOfferingSlug) return normalizedLeagueSlug;
	return `${normalizedLeagueSlug}-${normalizedOfferingSlug}`;
};

export const stripLegacyLeagueOfferingSuffix = (
	leagueSlug: string,
	offeringSlug: string | null | undefined
): string | null => {
	const normalizedLeagueSlug = normalizeIntramuralSlug(leagueSlug);
	const normalizedOfferingSlug = normalizeIntramuralSlug(offeringSlug);
	if (!normalizedLeagueSlug || !normalizedOfferingSlug) return null;
	const suffix = `-${normalizedOfferingSlug}`;
	if (!normalizedLeagueSlug.endsWith(suffix)) return null;
	const candidate = normalizedLeagueSlug.slice(0, -suffix.length);
	return candidate.length > 0 ? candidate : null;
};

export async function resolveOfferingForSeason(
	dbOps: DatabaseOperations,
	clientId: string,
	season: Season,
	offeringSlug: string
): Promise<Offering | null> {
	const normalizedOfferingSlug = normalizeIntramuralSlug(offeringSlug);
	if (!normalizedOfferingSlug) return null;

	const directMatch = await dbOps.offerings.getByClientIdSeasonIdAndSlug(
		clientId,
		season.id,
		normalizedOfferingSlug
	);
	if (directMatch?.id) return directMatch;

	const [offerings, leagues] = await Promise.all([
		dbOps.offerings.getByClientId(clientId),
		dbOps.leagues.getByClientId(clientId)
	]);

	const slugMatches = offerings.filter(
		(offering) => normalizeIntramuralSlug(offering.slug) === normalizedOfferingSlug
	);
	if (slugMatches.length === 0) return null;

	return (
		slugMatches.find((offering) => offering.seasonId === season.id) ??
		slugMatches.find((offering) =>
			leagues.some(
				(league) => league.offeringId === offering.id && leagueMatchesSeason(league, season)
			)
		) ??
		slugMatches[0] ??
		null
	);
}

export async function resolveLeagueForOffering(
	dbOps: DatabaseOperations,
	clientId: string,
	season: Season,
	offering: Offering,
	leagueSlug: string
): Promise<League | null> {
	const normalizedLeagueSlug = normalizeIntramuralSlug(leagueSlug);
	if (!normalizedLeagueSlug || !offering.id) return null;

	const directMatch = await dbOps.leagues.getByOfferingIdAndSlug(offering.id, normalizedLeagueSlug);
	if (directMatch?.id && leagueMatchesSeason(directMatch, season)) {
		return directMatch;
	}

	const legacyCandidateSlug = stripLegacyLeagueOfferingSuffix(normalizedLeagueSlug, offering.slug);
	if (legacyCandidateSlug) {
		const legacyDirectMatch = await dbOps.leagues.getByOfferingIdAndSlug(
			offering.id,
			legacyCandidateSlug
		);
		if (legacyDirectMatch?.id && leagueMatchesSeason(legacyDirectMatch, season)) {
			return legacyDirectMatch;
		}
	}

	const leagues = await dbOps.leagues.getByOfferingId(offering.id);
	return (
		leagues.find((league) => {
			if (!leagueMatchesSeason(league, season)) return false;
			const normalizedStoredSlug = normalizeIntramuralSlug(league.slug);
			const normalizedLegacySlug = buildLegacyLeagueSlug(league.name, offering.slug);
			return (
				normalizedStoredSlug === normalizedLeagueSlug || normalizedLegacySlug === normalizedLeagueSlug
			);
		}) ?? null
	);
}
