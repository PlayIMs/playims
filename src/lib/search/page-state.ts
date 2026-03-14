function readTrimmedParam(url: URL, key: string): string | null {
	const value = url.searchParams.get(key)?.trim() ?? '';
	return value.length > 0 ? value : null;
}

export function readMemberSearchSelection(url: URL): { memberId: string | null } {
	return {
		memberId: readTrimmedParam(url, 'memberId')
	};
}

export function readFacilitySearchSelection(url: URL): {
	facilityId: string | null;
	areaId: string | null;
} {
	return {
		facilityId: readTrimmedParam(url, 'facilityId'),
		areaId: readTrimmedParam(url, 'areaId')
	};
}

export function readLeagueSearchSelection(url: URL): { teamId: string | null } {
	return {
		teamId: readTrimmedParam(url, 'teamId')
	};
}
