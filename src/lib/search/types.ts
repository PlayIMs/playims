export type SearchCategory =
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

export interface SearchResult {
	id: string;
	resultKey: string;
	category: SearchCategory;
	title: string;
	subtitle: string | null;
	href: string;
	badge?: string | null;
	meta?: string | null;
	icon?: string | null;
}

export interface SearchGroup {
	category: SearchCategory;
	label: string;
	items: SearchResult[];
}

export interface SearchResponse {
	success: boolean;
	query: string;
	groups: SearchGroup[];
	totalCount: number;
	error?: string;
}

export interface SearchRecentPayload {
	resultKey: string;
	category: Exclude<SearchCategory, 'recent'> | 'recent';
	title: string;
	subtitle?: string | null;
	href: string;
	badge?: string | null;
	meta?: string | null;
}
