// Drizzle Kit configuration for Cloudflare D1
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/database/schema.ts',
	out: './src/lib/database/migrations',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
		token: process.env.CLOUDFLARE_API_TOKEN!
	},
	verbose: true,
	strict: true
});
