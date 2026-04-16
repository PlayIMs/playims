import type { SearchCategory, SearchGroup, SearchResult } from './types.js';

const CATEGORY_LABELS: Record<SearchCategory, string> = {
	pages: 'Pages',
	members: 'Members',
	seasons: 'Seasons',
	clubs: 'Clubs',
	offerings: 'Offerings',
	leagues: 'Leagues',
	divisions: 'Divisions',
	teams: 'Teams',
	facilities: 'Facilities',
	facilityAreas: 'Facility Areas',
	shortcuts: 'Shortcuts',
	recent: 'Recent'
};

export function normalizeSearchValue(value: string | null | undefined): string {
	return (
		value
			?.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim()
			.replace(/\s+/g, ' ') ?? ''
	);
}

function compactSearchValue(value: string): string {
	return value.replace(/\s+/g, '');
}

function tokenizeSearchValue(value: string): string[] {
	if (!value) return [];
	return value.split(' ').filter(Boolean);
}

function isSignificantSearchToken(token: string): boolean {
	return token.length >= 3;
}

function scorePhraseValue(query: string, candidate: string): number {
	const normalizedCandidate = normalizeSearchValue(candidate);
	if (!normalizedCandidate) return 0;

	const compactQuery = compactSearchValue(query);
	const compactCandidate = compactSearchValue(normalizedCandidate);

	if (normalizedCandidate === query || compactCandidate === compactQuery) return 400;
	if (normalizedCandidate.startsWith(query) || compactCandidate.startsWith(compactQuery))
		return 260;
	if (normalizedCandidate.includes(query) || compactCandidate.includes(compactQuery)) return 180;
	return 0;
}

function scoreTokenValue(token: string, candidate: string): number {
	const normalizedCandidate = normalizeSearchValue(candidate);
	if (!normalizedCandidate) return 0;

	const compactToken = compactSearchValue(token);
	const compactCandidate = compactSearchValue(normalizedCandidate);
	const candidateTokens = tokenizeSearchValue(normalizedCandidate);
	const isShortToken = compactToken.length <= 1;

	if (normalizedCandidate === token || compactCandidate === compactToken) {
		return 300;
	}
	if (candidateTokens.some((candidateToken) => candidateToken === token)) {
		return 240;
	}
	if (
		!isShortToken &&
		(normalizedCandidate.startsWith(token) || compactCandidate.startsWith(compactToken))
	) {
		return 220;
	}
	if (!isShortToken && candidateTokens.some((candidateToken) => candidateToken.startsWith(token))) {
		return 200;
	}
	if (
		!isShortToken &&
		(normalizedCandidate.includes(token) || compactCandidate.includes(compactToken))
	) {
		return 140;
	}
	return 0;
}

export function scoreSearchCandidate(
	query: string,
	candidates: Array<string | null | undefined>
): number {
	const normalizedQuery = normalizeSearchValue(query);
	if (!normalizedQuery) return 0;
	const normalizedCandidates = candidates
		.map((candidate) => normalizeSearchValue(candidate ?? ''))
		.filter(Boolean);
	if (normalizedCandidates.length === 0) return 0;

	const queryTokens = tokenizeSearchValue(normalizedQuery);
	const phraseBonus = normalizedCandidates.reduce(
		(best, candidate) => Math.max(best, scorePhraseValue(normalizedQuery, candidate)),
		0
	);

	let total = 0;
	let matchedTokens = 0;
	let matchedSignificantTokens = 0;
	for (const token of queryTokens) {
		const bestForToken = normalizedCandidates.reduce(
			(best, candidate) => Math.max(best, scoreTokenValue(token, candidate)),
			0
		);
		if (bestForToken > 0) {
			total += bestForToken;
			matchedTokens += 1;
			if (isSignificantSearchToken(token)) {
				matchedSignificantTokens += 1;
			}
		}
	}

	if (matchedTokens === 0) return 0;
	const significantQueryTokens = queryTokens.filter(isSignificantSearchToken);
	if (
		significantQueryTokens.length >= 2 &&
		matchedSignificantTokens < Math.max(2, Math.ceil(significantQueryTokens.length * 0.6))
	) {
		return 0;
	}
	return (
		total +
		matchedTokens * 90 +
		(matchedTokens === queryTokens.length && queryTokens.length > 1 ? 180 : 0) +
		phraseBonus
	);
}

export function groupSearchResults(
	results: Array<SearchResult & { score: number }>,
	options?: {
		perCategoryLimit?: number;
		totalLimit?: number;
	}
): {
	groups: SearchGroup[];
	totalCount: number;
} {
	const perCategoryLimit = options?.perCategoryLimit ?? 5;
	const totalLimit = options?.totalLimit ?? 25;
	const sorted = [...results].sort((left, right) => {
		if (right.score !== left.score) return right.score - left.score;
		return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
	});

	const grouped = new Map<SearchCategory, SearchResult[]>();
	let totalCount = 0;
	for (const result of sorted) {
		if (totalCount >= totalLimit) break;
		const current = grouped.get(result.category) ?? [];
		if (current.length >= perCategoryLimit) continue;
		current.push({
			id: result.id,
			resultKey: result.resultKey,
			category: result.category,
			title: result.title,
			subtitle: result.subtitle,
			href: result.href,
			badge: result.badge ?? null,
			meta: result.meta ?? null,
			icon: result.icon ?? null
		});
		grouped.set(result.category, current);
		totalCount += 1;
	}

	return {
		groups: Array.from(grouped.entries()).map(([category, items]) => ({
			category,
			label: CATEGORY_LABELS[category],
			items
		})),
		totalCount
	};
}

export function buildMemberSearchHref(input: { membershipId: string; fullName: string }): string {
	const url = new URL('https://playims.test/dashboard/members');
	url.searchParams.set('memberId', input.membershipId);
	url.searchParams.set('q', input.fullName.trim());
	return `${url.pathname}${url.search}`;
}

export function buildFacilityAreaSearchHref(input: {
	facilitySlug: string;
	facilityAreaSlug: string;
}): string {
	const url = new URL('https://playims.test/dashboard/facilities');
	url.searchParams.set('facility', input.facilitySlug);
	url.searchParams.set('area', input.facilityAreaSlug);
	return `${url.pathname}${url.search}`;
}

export function buildTeamSearchHref(input: {
	seasonSlug: string;
	offeringSlug: string;
	leagueSlug: string;
	divisionSlug: string;
	teamSlug: string;
}): string {
	return `/dashboard/offerings/${input.seasonSlug}/${input.offeringSlug}/${input.leagueSlug}/${input.divisionSlug}/${input.teamSlug}`;
}

export function buildClubTeamSearchHref(input: {
	seasonSlug: string;
	clubSlug: string;
	leagueSlug: string;
	teamSlug: string;
}): string {
	return `/dashboard/clubs/${input.seasonSlug}/${input.clubSlug}/${input.leagueSlug}/${input.teamSlug}`;
}
