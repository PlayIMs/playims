# Development Guide - Vercel Deployment with D1

## Your Setup

Your project uses:

- **SvelteKit** - Web framework
- **Vercel** - Hosting platform (via @sveltejs/adapter-vercel)
- **Cloudflare D1** - Database (accessed via REST API in production)
- **Drizzle ORM** - Type-safe database operations

---

## Two Development Modes

You have **two ways** to develop locally:

### Mode 1: Regular Dev Server (Default - Use This!)

**When to use:** Normal development, testing features, UI work

**Command:**

```bash
pnpm run dev
```

**How it works:**

- Runs SvelteKit dev server on `http://localhost:5173`
- Uses D1 REST API (same as production on Vercel)
- Hot module replacement (instant updates)
- Works with Vercel adapter
- **This is what you should use 99% of the time**

**What you'll see:**

- Your homepage at `http://localhost:5173`
- Full application with hot reload
- Database queries work via REST API

---

### Mode 2: Wrangler Dev (Optional - Testing Only)

**When to use:** Testing Drizzle ORM locally with actual D1 binding

**Commands:**

```bash
# Build first (required!)
pnpm run build

# Then start wrangler
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

**How it works:**

- Serves the **built** application
- Uses local D1 database file
- Drizzle ORM can access D1 directly
- Runs on `http://127.0.0.1:8788`

**Important:**

- You must build first: `pnpm run build`
- No hot reload - must rebuild after changes
- Only for testing D1/Drizzle integration
- **Not needed for normal development**

---

## Quick Start

### For Normal Development

```bash
# Start the dev server
pnpm run dev
```

Then open: **http://localhost:5173**

You'll see:

- ✅ Your PlayIMs homepage
- ✅ Live reload when you edit files
- ✅ Database queries working via REST API

### For Testing Drizzle/D1 Locally

```bash
# 1. Build the project
pnpm run build

# 2. Start wrangler
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

Then open: **http://127.0.0.1:8788**

---

## Why Two Modes?

### Regular Dev Server

- **Pros:**
  - Fast hot reload
  - Easy to use
  - Works with Vercel adapter
  - Same as production environment
- **Cons:**
  - Uses D1 REST API (slower queries)
  - Requires API tokens configured

### Wrangler Dev

- **Pros:**
  - Direct D1 access (faster)
  - Tests actual D1 binding
  - Good for Drizzle testing
- **Cons:**
  - Must rebuild after changes
  - No hot reload
  - Different from Vercel production
  - Only needed for Drizzle Studio

---

## Recommended Workflow

### Daily Development

```bash
pnpm run dev
```

Use this for all your normal work!

### Testing Database Migrations

```bash
# After creating new migrations
pnpm run db:migrate
pnpm run build
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

### Using Drizzle Studio

```bash
# Visual database browser
pnpm run db:studio
```

Opens at `https://local.drizzle.studio`

---

## Environment Variables

Your project needs these in `.env` for the D1 REST API:

```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_DATABASE_ID=66dc8c86-b1da-4882-b259-f7847ecf5350
CLOUDFLARE_API_TOKEN=your-api-token
```

These are used when running `pnpm run dev` (REST API mode).

---

## Troubleshooting

### "Page not found" on wrangler

**Problem:** Navigated to `http://127.0.0.1:8788` and got 404

**Solution:** You forgot to build first!

```bash
pnpm run build
# Then restart wrangler
```

### "Failed to open" browser with wrangler

**Normal!** Just manually open: `http://127.0.0.1:8788`

### Regular dev server not working

**Solution:**

1. Check that `.env` file exists with D1 credentials
2. Make sure port 5173 isn't in use
3. Try: `pnpm install` then `pnpm run dev`

### Database queries failing

**Check:**

- `.env` file has correct credentials
- D1 database exists and has tables
- Migrations were applied: `pnpm run db:migrate`

---

## Port Reference

| Tool               | Port | URL                          |
| ------------------ | ---- | ---------------------------- |
| **Regular dev**    | 5173 | http://localhost:5173        |
| **Wrangler dev**   | 8788 | http://127.0.0.1:8788        |
| **Drizzle Studio** | 4983 | https://local.drizzle.studio |

---

## Common Commands

```bash
# Development
pnpm run dev              # Start dev server (USE THIS!)
pnpm run build            # Build for production
pnpm run preview          # Preview production build

# Database
pnpm run db:generate      # Generate migration from schema
pnpm run db:migrate       # Apply migrations to D1
pnpm run db:studio        # Visual database browser

# Testing with wrangler
pnpm run build            # Build first!
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-25
```

---

## Deployment to Vercel

Your app is configured for Vercel deployment:

```bash
# Deploy
vercel --prod
```

**In production on Vercel:**

- Uses Vercel adapter (already configured)
- Database queries use D1 REST API
- Environment variables from Vercel dashboard
- Drizzle ORM works via REST API wrapper

---

## Summary

✅ **For daily development:** Use `pnpm run dev`  
✅ **For database management:** Use `pnpm run db:studio`  
✅ **For testing D1 locally:** Build first, then use wrangler  
✅ **For deployment:** Vercel (already configured)

**You're all set!** Just run `pnpm run dev` and start coding! 🚀
