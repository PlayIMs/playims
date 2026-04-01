/*
Brief description:
This file verifies shared search helper behavior for blank and non-blank query relevance expressions.

Deeper explanation:
Several database search operations sort by a computed relevance expression before falling back to a
name sort. A blank query should still generate a valid SQL expression instead of a bare numeric
literal, because SQLite treats `order by 0` as an invalid positional reference. These tests keep the
helper safe for blank-query search screens such as filter pickers and preload loaders.

Summary of tests:
1. It verifies that a blank query produces a constant SQL expression instead of a bare `0` chunk.
2. It verifies that a real query still produces a case-based relevance expression.
*/

import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { buildSearchRelevanceExpression } from '../../src/lib/database/operations/search-helpers';

const readFirstChunk = (expression: ReturnType<typeof buildSearchRelevanceExpression>): string => {
	// this unwraps the generated sql chunk so the regression stays focused on the emitted expression text.
	const firstChunk = expression.queryChunks[0] as { value?: string[] };
	return firstChunk.value?.join('') ?? '';
};

describe('search helpers', () => {
	it('avoids emitting a bare zero expression for blank queries', () => {
		// blank searches still need a sortable sql expression because sqlite rejects `order by 0`.
		const expression = buildSearchRelevanceExpression('', [sql`name`]);

		expect(readFirstChunk(expression)).not.toBe('0');
	});

	it('keeps the case-based relevance expression for populated queries', () => {
		// the helper should still rank exact, prefix, and contains matches when users type a search.
		const expression = buildSearchRelevanceExpression('soccer', [sql`name`]);

		expect(readFirstChunk(expression).toLowerCase()).toContain('case');
	});
});
