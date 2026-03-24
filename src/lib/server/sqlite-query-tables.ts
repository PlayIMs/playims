/**
 * Best-effort extraction of SQLite table names from SQL strings emitted by Drizzle.
 * Uses quoted identifiers (Drizzle's default) and common statement shapes.
 */

const QUOTED_TABLE_PATTERNS: RegExp[] = [
	/\bfrom\s+"([^"]+)"/gi,
	/\bjoin\s+"([^"]+)"/gi,
	/\bupdate\s+"([^"]+)"/gi,
	/\binsert\s+into\s+"([^"]+)"/gi,
	/\bdelete\s+from\s+"([^"]+)"/gi
];

export const extractSqliteTableNamesFromSql = (sql: string): string[] => {
	const found = new Set<string>();
	const normalized = sql.replace(/\s+/g, ' ');

	for (const pattern of QUOTED_TABLE_PATTERNS) {
		pattern.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(normalized)) !== null) {
			const name = match[1]?.trim();
			if (name) {
				found.add(name);
			}
		}
	}

	return [...found];
};

export type DbTableSink = Set<string>;

export const createDbTableSinkLogger = (sink: DbTableSink) => ({
	logQuery(query: string, _params?: unknown[]) {
		for (const name of extractSqliteTableNamesFromSql(query)) {
			sink.add(name);
		}
	}
});
