# Complete Setup: Pull Existing Tables from D1

## What I Just Fixed

✅ **Updated `drizzle.config.ts`** - Now uses D1 HTTP API to connect to your actual Cloudflare database  
✅ **Deleted old migrations** - Clean slate for fresh introspection  
✅ **Updated package.json scripts** - No more config path warnings  
✅ **Added `db:introspect` script** - Easy command to pull schema

---

## What You Need to Do Now

### Step 1: Create `.env` File

Create a file named `.env` in your project root with this content:

```env
# Cloudflare D1 Database Configuration

CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_DATABASE_ID=66dc8c86-b1da-4882-b259-f7847ecf5350
CLOUDFLARE_API_TOKEN=your-api-token-here
```

### Step 2: Get Your Cloudflare Account ID

1. Go to **https://dash.cloudflare.com/**
2. Log in to your Cloudflare account
3. Look at the **right sidebar**
4. You'll see **"Account ID"** with a copy button
5. Click copy and paste it into your `.env` file

```env
CLOUDFLARE_ACCOUNT_ID=abc123def456789  # ← Paste here
```

### Step 3: Create API Token

1. Go to **https://dash.cloudflare.com/profile/api-tokens**
2. Click **"Create Token"**
3. Click **"Custom token"** template
4. Give it a name: **"D1 Database Access"**
5. Set permissions:
   - **Account** → **Cloudflare D1** → **Edit**
6. Click **"Continue to summary"**
7. Click **"Create Token"**
8. **IMPORTANT:** Copy the token (you'll only see it once!)
9. Paste it into your `.env` file

```env
CLOUDFLARE_API_TOKEN=your_long_token_string_here  # ← Paste here
```

### Step 4: Verify Credentials Work

Test that your credentials are correct:

```bash
wrangler d1 list
```

If you see your database listed, your credentials work!

---

## Step 5: Run Introspect

Now you can pull all your existing tables:

```bash
pnpm run db:introspect
```

You should see output like:

```
[✓] 5 tables fetched      ← Your actual tables!
[✓] 23 columns fetched
[✓] 3 indexes fetched
[✓] Your schema file is ready ➜ src\lib\database\schema.ts 🚀
```

---

## Step 6: Review Generated Schema

Open `src/lib/database/schema.ts` and you'll see all your tables!

### Add Type Exports

For each table Drizzle generated, add type exports:

```typescript
// Example: If it generated a 'teams' table
export const teams = sqliteTable('teams', {
	// ... columns ...
});

// Add these lines:
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
```

Do this for **every table** in your schema.

---

## Step 7: Add Operations

For each new table, add CRUD operations in `src/lib/database/operations.ts`.

Example for a `teams` table:

```typescript
// Add to DatabaseOperations class

async getAllTeams() {
  return await this.db
    .select()
    .from(schema.teams)
    .orderBy(desc(schema.teams.createdAt));
}

async getTeamById(id: number) {
  const result = await this.db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.id, id))
    .limit(1);

  return result[0] || null;
}

async createTeam(data: { /* fields */ }) {
  const now = new Date().toISOString();
  const result = await this.db
    .insert(schema.teams)
    .values({
      ...data,
      createdAt: now,
      updatedAt: now
    })
    .returning();

  return result[0];
}

// ... update, delete methods ...
```

---

## Important Notes

### About the Config Warning

The warning "No config path provided" is now gone! I added `--config=drizzle.config.ts` to all your database scripts:

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

### About Migrations

Since your tables **already exist** in D1:

**Option A: Just Use the Schema (Recommended)**

- Run introspect to get schema
- Don't generate new migrations
- Don't run `db:migrate` (tables already exist!)
- Just start using Drizzle with type safety

**Option B: Generate Migrations for Version Control**

- Run introspect to get schema
- Run `pnpm run db:generate` to create baseline migrations
- **Don't apply them** (use `--remote` flag only if needed)
- Use migrations for future changes only

---

## Quick Checklist

- [ ] Create `.env` file in project root
- [ ] Add your Cloudflare Account ID
- [ ] Add your D1 Database ID (already there: `66dc8c86...`)
- [ ] Create and add Cloudflare API Token
- [ ] Run `pnpm run db:introspect`
- [ ] Review generated `schema.ts`
- [ ] Add type exports for each table
- [ ] Add operations in `operations.ts`
- [ ] Start using Drizzle!

---

## Troubleshooting

### "Invalid credentials" Error

- Double-check Account ID (no spaces, correct format)
- Verify API token (copy/paste carefully)
- Ensure token has D1:Edit permission

### Still Getting 0 Tables

- Make sure you're introspecting the right database
- Check that tables exist: `wrangler d1 execute playims-central-db-dev --command="SELECT name FROM sqlite_master WHERE type='table'" --remote`
- Verify database ID matches

### .gitignore

Make sure `.env` is in your `.gitignore` (it should be by default):

```gitignore
.env
.env.*
!.env.example
```

Never commit your `.env` file with credentials to git!

---

## Summary

1. **Create `.env` file** with Cloudflare credentials
2. **Run `pnpm run db:introspect`** to pull all tables
3. **Add type exports** to generated schema
4. **Add operations** for new tables
5. **Enjoy type safety** with all your existing tables!

Once your `.env` is set up, you're ready to go! 🚀
