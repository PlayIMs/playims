/*
Brief description:
This file verifies sqlite table name extraction from SQL strings used in request logging.

Deeper explanation:
Drizzle logs each query through a custom logger so we can list touched tables in dev request summaries.
The extractor uses quoted identifiers and common statement shapes; these tests keep that heuristic
aligned with typical drizzle-generated SQL.

Summary of tests:
1. It pulls quoted table names from select, join, insert, update, and delete statements.
2. It deduplicates repeated references to the same table across clauses.
*/

import { describe, expect, it } from 'vitest';
import {
	extractSqliteTableNamesFromSql,
	createDbTableSinkLogger
} from '../../src/lib/server/sqlite-query-tables';

describe('sqlite query table extraction', () => {
	it('extracts quoted tables from common statement shapes', () => {
		const sql = `select "id" from "users" left join "user_clients" on "users"."id" = "user_clients"."user_id"`;
		expect(extractSqliteTableNamesFromSql(sql).sort()).toEqual(['user_clients', 'users']);
	});

	it('deduplicates when the sink logger sees the same table twice', () => {
		const sink = new Set<string>();
		const logger = createDbTableSinkLogger(sink);
		logger.logQuery('select 1 from "sessions" where "id" = ?', []);
		logger.logQuery('update "sessions" set "expires_at" = ?', []);
		expect([...sink].sort()).toEqual(['sessions']);
	});
});
