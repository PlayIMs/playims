export type ScheduleEventWizardOptions = {
	seasons: Array<{
		id: string;
		name: string;
		isCurrent: boolean;
	}>;
	offerings: Array<{
		id: string;
		seasonId: string | null;
		name: string;
	}>;
	leagues: Array<{
		id: string;
		seasonId: string | null;
		offeringId: string | null;
		name: string;
	}>;
	divisions: Array<{
		id: string;
		leagueId: string | null;
		name: string;
	}>;
	teams: Array<{
		id: string;
		divisionId: string | null;
		name: string;
	}>;
	facilities: Array<{
		id: string;
		name: string;
	}>;
	facilityAreas: Array<{
		id: string;
		facilityId: string | null;
		name: string;
	}>;
};

export type ScheduleEventWizardSelection = {
	seasonId: string;
	offeringId: string;
	leagueId: string;
	divisionId: string;
	homeTeamId: string;
	awayTeamId: string;
	facilityId: string;
	facilityAreaId: string;
};

export type ScheduleEventWizardCollections = {
	offeringOptions: ScheduleEventWizardOptions['offerings'];
	leagueOptions: ScheduleEventWizardOptions['leagues'];
	divisionOptions: ScheduleEventWizardOptions['divisions'];
	teamOptions: ScheduleEventWizardOptions['teams'];
	homeTeamOptions: ScheduleEventWizardOptions['teams'];
	awayTeamOptions: ScheduleEventWizardOptions['teams'];
	facilityAreaOptions: ScheduleEventWizardOptions['facilityAreas'];
};

function optionExists<T extends { id: string }>(options: T[], id: string): boolean {
	return Boolean(id) && options.some((option) => option.id === id);
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
	return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildScheduleEventWizardCollections(
	options: ScheduleEventWizardOptions,
	selection: ScheduleEventWizardSelection
): ScheduleEventWizardCollections {
	const offeringOptions = sortByName(
		options.offerings.filter(
			(offering) => !selection.seasonId || offering.seasonId === selection.seasonId
		)
	);
	const leagueOptions = sortByName(
		options.leagues.filter((league) => {
			if (selection.offeringId && league.offeringId !== selection.offeringId) return false;
			if (selection.seasonId && league.seasonId && league.seasonId !== selection.seasonId)
				return false;
			return true;
		})
	);
	const divisionOptions = sortByName(
		options.divisions.filter(
			(division) => !selection.leagueId || division.leagueId === selection.leagueId
		)
	);
	const teamOptions = sortByName(
		options.teams.filter(
			(team) => !selection.divisionId || team.divisionId === selection.divisionId
		)
	);
	const facilityAreaOptions = sortByName(
		options.facilityAreas.filter(
			(area) => !selection.facilityId || area.facilityId === selection.facilityId
		)
	);

	return {
		offeringOptions,
		leagueOptions,
		divisionOptions,
		teamOptions,
		homeTeamOptions: teamOptions.filter((team) => team.id !== selection.awayTeamId),
		awayTeamOptions: teamOptions.filter((team) => team.id !== selection.homeTeamId),
		facilityAreaOptions
	};
}

export function sanitizeScheduleEventWizardSelection(
	options: ScheduleEventWizardOptions,
	selection: ScheduleEventWizardSelection
): ScheduleEventWizardSelection {
	const nextSeasonId = optionExists(options.seasons, selection.seasonId) ? selection.seasonId : '';
	const collectionsForSeason = buildScheduleEventWizardCollections(options, {
		...selection,
		seasonId: nextSeasonId,
		offeringId: '',
		leagueId: '',
		divisionId: '',
		homeTeamId: '',
		awayTeamId: ''
	});
	const nextOfferingId = optionExists(collectionsForSeason.offeringOptions, selection.offeringId)
		? selection.offeringId
		: '';
	const collectionsForOffering = buildScheduleEventWizardCollections(options, {
		...selection,
		seasonId: nextSeasonId,
		offeringId: nextOfferingId,
		leagueId: '',
		divisionId: '',
		homeTeamId: '',
		awayTeamId: ''
	});
	const nextLeagueId = optionExists(collectionsForOffering.leagueOptions, selection.leagueId)
		? selection.leagueId
		: '';
	const collectionsForLeague = buildScheduleEventWizardCollections(options, {
		...selection,
		seasonId: nextSeasonId,
		offeringId: nextOfferingId,
		leagueId: nextLeagueId,
		divisionId: '',
		homeTeamId: '',
		awayTeamId: ''
	});
	const nextDivisionId =
		nextLeagueId && optionExists(collectionsForLeague.divisionOptions, selection.divisionId)
			? selection.divisionId
			: '';
	const collectionsForDivision = buildScheduleEventWizardCollections(options, {
		...selection,
		seasonId: nextSeasonId,
		offeringId: nextOfferingId,
		leagueId: nextLeagueId,
		divisionId: nextDivisionId,
		homeTeamId: '',
		awayTeamId: ''
	});
	const nextHomeTeamId =
		nextDivisionId && optionExists(collectionsForDivision.teamOptions, selection.homeTeamId)
			? selection.homeTeamId
			: '';
	const nextAwayTeamId =
		nextDivisionId &&
		selection.awayTeamId !== nextHomeTeamId &&
		optionExists(collectionsForDivision.teamOptions, selection.awayTeamId)
			? selection.awayTeamId
			: '';
	const nextFacilityId = optionExists(options.facilities, selection.facilityId)
		? selection.facilityId
		: '';
	const nextFacilityAreaId = optionExists(
		buildScheduleEventWizardCollections(options, {
			...selection,
			seasonId: nextSeasonId,
			offeringId: nextOfferingId,
			leagueId: nextLeagueId,
			divisionId: nextDivisionId,
			homeTeamId: nextHomeTeamId,
			awayTeamId: nextAwayTeamId,
			facilityId: nextFacilityId
		}).facilityAreaOptions,
		selection.facilityAreaId
	)
		? selection.facilityAreaId
		: '';

	return {
		seasonId: nextSeasonId,
		offeringId: nextOfferingId,
		leagueId: nextLeagueId,
		divisionId: nextDivisionId,
		homeTeamId: nextHomeTeamId,
		awayTeamId: nextAwayTeamId,
		facilityId: nextFacilityId,
		facilityAreaId: nextFacilityAreaId
	};
}
