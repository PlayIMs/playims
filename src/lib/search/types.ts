export type MegaSearchCategory =
	| 'pages'
	| 'members'
	| 'seasons'
	| 'offerings'
	| 'leagues'
	| 'divisions'
	| 'teams'
	| 'facilities'
	| 'facilityAreas'
	| 'shortcuts'
	| 'recent';

export interface MegaSearchResult {
	id: string;
	resultKey: string;
	category: MegaSearchCategory;
	title: string;
	subtitle: string | null;
	href: string;
	badge?: string | null;
	meta?: string | null;
	icon?: string | null;
}

export interface MegaSearchGroup {
	category: MegaSearchCategory;
	label: string;
	items: MegaSearchResult[];
}

export interface MegaSearchResponse {
	success: boolean;
	query: string;
	groups: MegaSearchGroup[];
	totalCount: number;
	error?: string;
}

export interface MegaSearchRecentPayload {
	resultKey: string;
	category: Exclude<MegaSearchCategory, 'recent'> | 'recent';
	title: string;
	subtitle?: string | null;
	href: string;
	badge?: string | null;
	meta?: string | null;
}
