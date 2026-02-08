import { defineConfig } from 'drizzle-kit';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const localD1Dir = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const localSqliteFile = readdirSync(localD1Dir).find((file) => file.endsWith('.sqlite'));

if (!localSqliteFile) {
	throw new Error(
		`No local D1 sqlite file found in ${localD1Dir}. Run 'pnpm db:migrate:local' first.`
	);
}

export default defineConfig({
	schema: './src/lib/database/schema/index.ts',
	out: './src/lib/database/migrations',
	dialect: 'sqlite',
	dbCredentials: {
		// Drizzle sqlite config expects a file URL string.
		url: pathToFileURL(resolve(localD1Dir, localSqliteFile)).href
	},
	verbose: true,
	strict: true
});
