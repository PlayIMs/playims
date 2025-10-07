# Setup Guide: Introspecting Your D1 Database

## Why Introspect Returned Nothing

The `pnpm drizzle-kit introspect` command found 0 tables because:

1. **Missing credentials** - No `.env` file with Cloudflare API access
2. **Wrong driver config** - Was pointing to local file instead of D1 HTTP API

## ✅ Fixed Configuration

I've updated your `drizzle.config.ts` to use the D1 HTTP API:

```typescript
export default defineConfig({
	schema: './src/lib/database/schema.ts',
	out: './src/lib/database/migrations',
	dialect: 'sqlite',
	driver: 'd1-http', // ← Uses Cloudflare D1 REST API
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
		databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
		token: process.env.CLOUDFLARE_API_TOKEN!
	},
	verbose: true,
	strict: true
});
```

This will pull from your **actual D1 database on Cloudflare**, not the local file.

---

## Step 1: Create .env File

Create a file named `.env` in your project root:

```env
# Cloudflare D1 Database Configuration

# Your Cloudflare Account ID
CLOUDFLARE_ACCOUNT_ID=your-account-id-here

# Your D1 Database ID
CLOUDFLARE_DATABASE_ID=66dc8c86-b1da-4882-b259-f7847ecf5350

# Your Cloudflare API Token
CLOUDFLARE_API_TOKEN=your-api-token-here
```

---

## Step 2: Get Your Cloudflare Credentials

### Account ID

1. Go to https://dash.cloudflare.com/
2. Log in
3. Look in the **right sidebar** - your Account ID is displayed there
4. Copy it

### API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Choose **"Custom token"**
4. Set permissions:
   - **Account** → **Cloudflare D1** → **Edit**
5. Click **"Continue to summary"**
6. Click **"Create Token"**
7. **Copy the token** (you won't see it again!)

### Fill in .env

Update your `.env` file with the actual values:

```env
CLOUDFLARE_ACCOUNT_ID=abc123def456  # Your actual account ID
CLOUDFLARE_DATABASE_ID=66dc8c86-b1da-4882-b259-f7847ecf5350
CLOUDFLARE_API_TOKEN=your_actual_token_here  # The token you just created
```

---

## Step 3: Clean Up Old Migrations (Done!)

I've already deleted:

- ✅ `0000_wise_the_hand.sql`
- ✅ `meta/_journal.json`
- ✅ `meta/0000_snapshot.json`
- ✅ `relations.ts` (from wrong location)
- ✅ `schema.ts` (from wrong location)

Your migrations folder is now clean!

---

## Step 4: Run Introspect Again

Once your `.env` file is set up with real credentials:

```bash
pnpm drizzle-kit introspect
```

This will:

- ✅ Connect to your actual D1 database on Cloudflare
- ✅ Read all your existing tables
- ✅ Generate the schema in `src/lib/database/schema.ts`
- ✅ Show you how many tables it found

---

## Step 5: Specify Config File Location (No More Warning)

To avoid the "No config path provided" warning, you can:

### Option A: Use the --config flag

```bash
pnpm drizzle-kit introspect --config=drizzle.config.ts
```

### Option B: Add it to package.json

Update your scripts in `package.json`:

```json
{
	"scripts": {
		"db:generate": "drizzle-kit generate --config=drizzle.config.ts",
		"db:introspect": "drizzle-kit introspect --config=drizzle.config.ts",
		"db:studio": "drizzle-kit studio --config=drizzle.config.ts",
		"db:push": "drizzle-kit push --config=drizzle.config.ts"
	}
}
```

Then use:

```bash
pnpm run db:introspect
```

### Option C: Drizzle Looks for drizzle.config.ts Automatically

Actually, drizzle already looks for `drizzle.config.ts` in the root by default, so the warning is harmless. You can ignore it!

---

## Expected Output After Setup

Once you have credentials and run introspect:

```bash
C:\...\playims> pnpm drizzle-kit introspect

No config path provided, using default 'drizzle.config.ts'
Reading config file 'C:\...\drizzle.config.ts'
Pulling from ['public'] list of schemas

[✓] 5 tables fetched      ← You should see your tables!
[✓] 23 columns fetched
[✓] 3 indexes fetched
[✓] 0 foreign keys fetched
[✓] 0 check constraints fetched

[✓] Your schema file is ready ➜ src\lib\database\schema.ts 🚀
```

---

## Troubleshooting

### Still Getting 0 Tables?

**Check:**

1. `.env` file exists in project root
2. All three environment variables are set correctly
3. API token has D1:Edit permission
4. Database ID matches your D1 database

**Verify your credentials work:**

```bash
# Test API access
wrangler d1 list
```

If this works, your credentials are correct.

### Error: "Invalid credentials"

Double-check:

- Account ID is correct (no spaces)
- Database ID matches wrangler.toml
- API token is valid and has D1 permissions

### Introspect Created Files in Wrong Location

I already deleted these:

- `src/lib/database/migrations/schema.ts` ← Wrong location
- `src/lib/database/migrations/relations.ts` ← Wrong location

After setup, introspect should update `src/lib/database/schema.ts` correctly.

---

## Alternative: Use Wrangler to View Tables

If introspect still doesn't work, you can manually check your tables:

```bash
# List all tables
wrangler d1 execute playims-central-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'" --remote

# For each table, get structure
wrangler d1 execute playims-central-db-dev --command="PRAGMA table_info(table_name)" --remote

# Get table creation SQL
wrangler d1 execute playims-central-db-dev --command="SELECT sql FROM sqlite_master WHERE name='table_name'" --remote
```

Then manually add them to `src/lib/database/schema.ts`.

---

## Summary of Changes

✅ **Updated `drizzle.config.ts`** - Now uses D1 HTTP API with credentials  
✅ **Deleted old migrations** - Clean slate for introspection  
✅ **Ready for introspect** - Just need to add credentials to `.env`

---

## Next Steps

1. **Create `.env` file** with your Cloudflare credentials
2. **Run introspect**: `pnpm drizzle-kit introspect`
3. **Review `src/lib/database/schema.ts`** - should have all your tables!
4. **Add type exports** for each table
5. **Add operations** in `operations.ts`
6. **Start using Drizzle** with all your tables!

---

Once you have your `.env` file set up, the introspect command will pull all your tables automatically! 🚀
