export function appendSeasonQueryToBreadcrumbHref(
	href: string,
	input: {
		seasonSlug: string | null | undefined;
		includeSeasonQuery: boolean;
	}
): string {
	const seasonSlug = input.seasonSlug?.trim() ?? '';
	if (!input.includeSeasonQuery || !seasonSlug) {
		return href;
	}

	const url = new URL(href, 'https://playims.test');
	url.searchParams.set('season', seasonSlug);
	return `${url.pathname}${url.search}${url.hash}`;
}

export function shouldShowBreadcrumbSeasonContext(
	segmentKey: string,
	includeSeasonContext: boolean
): boolean {
	return includeSeasonContext && segmentKey !== 'offerings';
}
