import { slugifyFinal } from '$lib/components/wizard/slug-utils.js';

export type ClubSeasonWizardStep = 1 | 2 | 3;
export type ClubSportWizardStep = 1 | 2;
export type ClubLeagueWizardStep = 1 | 2;

export interface ClubSeasonWizardForm {
	name: string;
	slug: string;
	startDate: string;
	endDate: string;
	isCurrent: boolean;
}

export interface ClubSeasonWizardCopyForm {
	enabled: boolean;
	sourceSeasonIds: string[];
	includeClubs: boolean;
	includeLeagues: boolean;
	includeTeams: boolean;
	includeOfficers: boolean;
	includeRosters: boolean;
	includeSchedules: boolean;
}

export interface ClubSportWizardForm {
	clubSeasonId: string;
	name: string;
	slug: string;
	sport: string;
}

export interface ClubLeagueWizardForm {
	clubId: string;
	name: string;
	slug: string;
	gender: string;
}

interface ExistingSeasonLike {
	id: string;
	name: string;
	slug: string;
}

interface ExistingClubActivityLike {
	seasonId: string;
	clubId: string;
	clubName: string;
	clubSlug: string;
	leagueName?: string;
	leagueSlug?: string;
}

export function createEmptyClubSeasonWizardForm(isCurrent = true): ClubSeasonWizardForm {
	return {
		name: '',
		slug: '',
		startDate: '',
		endDate: '',
		isCurrent
	};
}

export function createEmptyClubSeasonWizardCopy(
	defaultSourceSeasonId = ''
): ClubSeasonWizardCopyForm {
	return {
		enabled: false,
		sourceSeasonIds: defaultSourceSeasonId ? [defaultSourceSeasonId] : [],
		includeClubs: true,
		includeLeagues: true,
		includeTeams: true,
		includeOfficers: false,
		includeRosters: false,
		includeSchedules: false
	};
}

export function createEmptyClubSportWizardForm(defaultSeasonId = ''): ClubSportWizardForm {
	return {
		clubSeasonId: defaultSeasonId,
		name: '',
		slug: '',
		sport: ''
	};
}

export function createEmptyClubLeagueWizardForm(defaultClubId = ''): ClubLeagueWizardForm {
	return {
		clubId: defaultClubId,
		name: '',
		slug: '',
		gender: ''
	};
}

function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

function toDateMs(value: string): number | null {
	const normalized = value.trim();
	if (!normalized) return null;
	const parsed = new Date(normalized).getTime();
	return Number.isNaN(parsed) ? null : parsed;
}

function getSeasonFieldErrors(
	form: ClubSeasonWizardForm,
	seasons: ExistingSeasonLike[]
): Record<string, string> {
	const errors: Record<string, string> = {};
	const seasonName = form.name.trim();
	const seasonSlug = slugifyFinal(form.slug);
	const startDate = form.startDate.trim();
	const endDate = form.endDate.trim();

	if (!seasonName) {
		errors['season.name'] = 'Season name is required.';
	} else if (seasons.some((season) => normalizeName(season.name) === normalizeName(seasonName))) {
		errors['season.name'] = 'A club season with this name already exists.';
	}

	if (!seasonSlug) {
		errors['season.slug'] = 'Season slug is required.';
	} else if (seasons.some((season) => slugifyFinal(season.slug) === seasonSlug)) {
		errors['season.slug'] = 'A club season with this slug already exists.';
	}

	if (!startDate) {
		errors['season.startDate'] = 'Start date is required.';
	}

	if (startDate && endDate) {
		const startMs = toDateMs(startDate);
		const endMs = toDateMs(endDate);
		if (startMs !== null && endMs !== null && endMs < startMs) {
			errors['season.endDate'] = 'End date must be on or after the start date.';
		}
	}

	return errors;
}

function getSeasonCopyErrors(copy: ClubSeasonWizardCopyForm): Record<string, string> {
	if (!copy.enabled) return {};

	const errors: Record<string, string> = {};
	if (copy.sourceSeasonIds.length === 0) {
		errors['copy.sourceSeasonIds'] = 'Choose at least one source season.';
	}

	if (!copy.includeClubs && (copy.includeLeagues || copy.includeTeams || copy.includeOfficers)) {
		errors['copy.includeClubs'] =
			'Clubs must be included before leagues, teams, or officers can be copied.';
	}

	if (!copy.includeLeagues && (copy.includeTeams || copy.includeSchedules)) {
		errors['copy.includeLeagues'] =
			'Leagues must be included before teams or schedules can be copied.';
		if (copy.includeTeams) {
			errors['copy.includeTeams'] = 'Teams can only be copied when leagues are included.';
		}
	}

	if ((!copy.includeTeams || !copy.includeLeagues) && copy.includeRosters) {
		if (!copy.includeTeams && !errors['copy.includeTeams']) {
			errors['copy.includeTeams'] = 'Teams can only be copied when leagues are included.';
		}
		errors['copy.includeRosters'] = 'Rosters can only be copied when teams are included.';
	}

	return errors;
}

export function getClubSeasonWizardStepErrors(
	form: ClubSeasonWizardForm,
	copy: ClubSeasonWizardCopyForm,
	seasons: ExistingSeasonLike[],
	step: ClubSeasonWizardStep
): Record<string, string> {
	const allErrors = {
		...getSeasonFieldErrors(form, seasons),
		...getSeasonCopyErrors(copy)
	};

	if (step === 1) {
		return pickErrors(allErrors, [
			'season.name',
			'season.slug',
			'season.startDate',
			'season.endDate'
		]);
	}

	if (step === 2) {
		return pickErrors(allErrors, [
			'copy.sourceSeasonIds',
			'copy.includeClubs',
			'copy.includeLeagues',
			'copy.includeTeams',
			'copy.includeRosters'
		]);
	}

	return allErrors;
}

export function firstInvalidClubSeasonWizardStep(
	errors: Record<string, string>
): ClubSeasonWizardStep {
	for (const key of Object.keys(errors)) {
		if (key.startsWith('season.')) return 1;
		if (key.startsWith('copy.')) return 2;
	}
	return 3;
}

function getUniqueClubsBySeason(
	activities: ExistingClubActivityLike[],
	seasonId: string
): Array<{ clubName: string; clubSlug: string }> {
	const clubs = new Map<string, { clubName: string; clubSlug: string }>();
	for (const activity of activities) {
		if (activity.seasonId !== seasonId || clubs.has(activity.clubId)) continue;
		clubs.set(activity.clubId, {
			clubName: activity.clubName,
			clubSlug: activity.clubSlug
		});
	}
	return Array.from(clubs.values());
}

function getClubFieldErrors(
	form: ClubSportWizardForm,
	activities: ExistingClubActivityLike[]
): Record<string, string> {
	const errors: Record<string, string> = {};
	const seasonId = form.clubSeasonId.trim();
	const clubName = form.name.trim();
	const clubSlug = slugifyFinal(form.slug);

	if (!seasonId) {
		errors['club.clubSeasonId'] = 'Club season is required.';
	}

	if (!clubName) {
		errors['club.name'] = 'Club name is required.';
	}

	if (!clubSlug) {
		errors['club.slug'] = 'Club slug is required.';
	}

	if (seasonId && clubName) {
		const seasonClubs = getUniqueClubsBySeason(activities, seasonId);
		if (seasonClubs.some((club) => normalizeName(club.clubName) === normalizeName(clubName))) {
			errors['club.name'] = 'A club sport with this name already exists for the selected season.';
		}
	}

	if (seasonId && clubSlug) {
		const seasonClubs = getUniqueClubsBySeason(activities, seasonId);
		if (seasonClubs.some((club) => slugifyFinal(club.clubSlug) === clubSlug)) {
			errors['club.slug'] = 'A club sport with this slug already exists for the selected season.';
		}
	}

	return errors;
}

export function getClubSportWizardStepErrors(
	form: ClubSportWizardForm,
	activities: ExistingClubActivityLike[],
	step: ClubSportWizardStep
): Record<string, string> {
	const allErrors = getClubFieldErrors(form, activities);
	if (step === 1) {
		return pickErrors(allErrors, ['club.clubSeasonId', 'club.name', 'club.slug']);
	}
	return allErrors;
}

export function firstInvalidClubSportWizardStep(
	errors: Record<string, string>
): ClubSportWizardStep {
	for (const key of Object.keys(errors)) {
		if (key.startsWith('club.')) return 1;
	}
	return 2;
}

function getUniqueLeaguesByClub(
	activities: ExistingClubActivityLike[],
	clubId: string
): Array<{ leagueName: string; leagueSlug: string }> {
	const leagues = new Map<string, { leagueName: string; leagueSlug: string }>();
	for (const activity of activities) {
		if (activity.clubId !== clubId) continue;
		const leagueName = activity.leagueName?.trim() ?? '';
		const leagueSlug = activity.leagueSlug?.trim() ?? '';
		const leagueKey = `${leagueName}::${leagueSlug}`;
		if (!leagueName || leagues.has(leagueKey)) continue;
		leagues.set(leagueKey, { leagueName, leagueSlug });
	}
	return Array.from(leagues.values());
}

function getLeagueFieldErrors(
	form: ClubLeagueWizardForm,
	activities: ExistingClubActivityLike[]
): Record<string, string> {
	const errors: Record<string, string> = {};
	const clubId = form.clubId.trim();
	const leagueName = form.name.trim();
	const leagueSlug = slugifyFinal(form.slug);

	if (!clubId) {
		errors['league.clubId'] = 'Club sport is required.';
	}

	if (!leagueName) {
		errors['league.name'] = 'League name is required.';
	}

	if (!leagueSlug) {
		errors['league.slug'] = 'League slug is required.';
	}

	if (clubId && leagueName) {
		const clubLeagues = getUniqueLeaguesByClub(activities, clubId);
		if (
			clubLeagues.some((league) => normalizeName(league.leagueName) === normalizeName(leagueName))
		) {
			errors['league.name'] = 'A league with this name already exists for the selected club sport.';
		}
	}

	if (clubId && leagueSlug) {
		const clubLeagues = getUniqueLeaguesByClub(activities, clubId);
		if (clubLeagues.some((league) => slugifyFinal(league.leagueSlug) === leagueSlug)) {
			errors['league.slug'] = 'A league with this slug already exists for the selected club sport.';
		}
	}

	return errors;
}

export function getClubLeagueWizardStepErrors(
	form: ClubLeagueWizardForm,
	activities: ExistingClubActivityLike[],
	step: ClubLeagueWizardStep
): Record<string, string> {
	const allErrors = getLeagueFieldErrors(form, activities);
	if (step === 1) {
		return pickErrors(allErrors, ['league.clubId', 'league.name', 'league.slug']);
	}
	return allErrors;
}

export function firstInvalidClubLeagueWizardStep(
	errors: Record<string, string>
): ClubLeagueWizardStep {
	for (const key of Object.keys(errors)) {
		if (key.startsWith('league.')) return 1;
	}
	return 2;
}

function pickErrors(errors: Record<string, string>, keys: string[]): Record<string, string> {
	const subset: Record<string, string> = {};
	for (const key of keys) {
		if (errors[key]) {
			subset[key] = errors[key];
		}
	}
	return subset;
}
