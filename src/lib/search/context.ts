export type SearchPaletteContext = {
	isClubSportsContext: boolean;
	seasonEndpoint: '/api/intramural-sports/seasons' | '/api/club-sports/seasons';
	seasonQueryParam: 'season' | 'clubSeason';
};

export function resolveSearchPaletteContext(pathname: string): SearchPaletteContext {
	const normalizedPath = pathname.trim();
	if (normalizedPath === '/dashboard/clubs' || normalizedPath.startsWith('/dashboard/clubs/')) {
		return {
			isClubSportsContext: true,
			seasonEndpoint: '/api/club-sports/seasons',
			seasonQueryParam: 'clubSeason'
		};
	}

	return {
		isClubSportsContext: false,
		seasonEndpoint: '/api/intramural-sports/seasons',
		seasonQueryParam: 'season'
	};
}
