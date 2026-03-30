import { or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

export const escapeSearchLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

export const normalizeSearchText = (value: string | null | undefined): string =>
	value?.trim().toLowerCase().replace(/\s+/g, ' ') ?? '';

export const splitSearchTokens = (value: string): string[] =>
	normalizeSearchText(value)
		.split(' ')
		.map((token) => token.trim())
		.filter((token) => token.length > 0);

export const buildSearchTokenClauses = (query: string, expressions: SQLWrapper[]): SQL[] => {
	const tokens = splitSearchTokens(query);
	if (tokens.length === 0) {
		return [];
	}

	return tokens.map((token) => {
		const pattern = `%${escapeSearchLike(token)}%`;
		return or(
			...expressions.map(
				(expression) => sql`lower(trim(coalesce(${expression}, ''))) like ${pattern} escape '\\'`
			)
		) as SQL;
	});
};

export const buildSearchRelevanceExpression = (
	query: string,
	expressions: SQLWrapper[]
): SQL<number> => {
	const normalizedQuery = normalizeSearchText(query);
	if (!normalizedQuery) {
		return sql<number>`0`;
	}

	const exactQuery = normalizedQuery;
	const prefixQuery = `${escapeSearchLike(normalizedQuery)}%`;
	const containsQuery = `%${escapeSearchLike(normalizedQuery)}%`;

	const exactMatch = or(
		...expressions.map(
			(expression) => sql`lower(trim(coalesce(${expression}, ''))) = ${exactQuery}`
		)
	);
	const prefixMatch = or(
		...expressions.map(
			(expression) => sql`lower(trim(coalesce(${expression}, ''))) like ${prefixQuery} escape '\\'`
		)
	);
	const containsMatch = or(
		...expressions.map(
			(expression) =>
				sql`lower(trim(coalesce(${expression}, ''))) like ${containsQuery} escape '\\'`
		)
	);

	return sql<number>`case
		when ${exactMatch} then 3
		when ${prefixMatch} then 2
		when ${containsMatch} then 1
		else 0
	end`;
};
