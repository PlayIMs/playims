/*
Brief description:
This file verifies how request logs format touched database tables (noise filtering and plural labels).

Deeper explanation:
Dev request summaries list sqlite tables touched during a request. Session and auth rate-limit queries
run on most authenticated traffic, so they are filtered out. The log line uses `table=` for a single
name and `tables=` when more than one remains after filtering.

Summary of tests:
1. It drops sessions and auth_rate_limits from the reported set.
2. It uses key `table` for one remaining name and `tables` for multiple sorted names.
3. It reports no_db_queries when nothing remains after filtering.
*/

import { describe, expect, it } from 'vitest';
import { formatRequestLogTables } from '../../src/lib/server/request-logger';

describe('formatRequestLogTables', () => {
	it('omits sessions and auth_rate_limits noise tables', () => {
		const touched = new Set(['sessions', 'auth_rate_limits', 'themes']);
		expect(formatRequestLogTables(touched, null)).toEqual({
			key: 'table',
			value: 'themes'
		});
	});

	it('uses tables= when multiple names remain', () => {
		const touched = new Set(['offerings', 'leagues']);
		expect(formatRequestLogTables(touched, null)).toEqual({
			key: 'tables',
			value: 'leagues,offerings'
		});
	});

	it('returns no_db_queries when only noise tables were touched', () => {
		const touched = new Set(['sessions', 'auth_rate_limits']);
		expect(formatRequestLogTables(touched, null)).toEqual({
			key: 'table',
			value: 'no_db_queries'
		});
	});

	it('filters noise from manual loader hints too', () => {
		expect(formatRequestLogTables(undefined, 'sessions,users')).toEqual({
			key: 'table',
			value: 'users'
		});
	});
});
