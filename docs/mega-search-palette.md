# Mega Search Palette: Behavior, Priorities, and Ranking

This document explains exactly how PlayIMs mega search works today, including:

- Where it is mounted and how it opens
- Which data sources are searched
- How season scoping works
- How scoring is calculated
- How priorities are enforced (including team boosting)
- How grouping and limits are applied
- How recents and shortcuts work for empty state
- How search result links hydrate destination page state

The implementation lives primarily in:

- `src/lib/components/MegaSearchPalette.svelte`
- `src/lib/server/search/service.ts`
- `src/lib/search/utils.ts`
- `src/lib/server/search/recent.ts`

---

## 1) High-level architecture

Mega search is a global modal palette rendered in root layout (`src/routes/+layout.svelte` via `<MegaSearchPalette />`), so it is available everywhere in the app shell.

The architecture is split into two layers:

1. **Client/UI layer** (`MegaSearchPalette.svelte`)
  - Handles keyboard shortcut, modal open/close, debounce, highlighting, and navigation.
  - Calls `GET /api/search?q=...` (and optionally `season=...`) for search results.
  - Calls `POST /api/search/recent` when a result is selected.
2. **Server/search layer** (`service.ts` + `utils.ts`)
  - Builds candidate results from pages + data records.
  - Computes relevance score per result.
  - Sorts, groups, and caps output.
  - Returns grouped payload consumed directly by the palette.

---

## 2) UX flow and keyboard behavior

### Open/close behavior

- Shortcut is:
  - `Cmd + K` on macOS/iOS/iPadOS-like user agents
  - `Ctrl + K` on other platforms
- If focus is inside an editable control (`input`, `textarea`, `select`, or `contenteditable`) and palette is closed, the shortcut is ignored to avoid hijacking typing contexts.
- Opening the palette resets query/results/highlight state and focuses the input.
- Closing the palette restores focus to the element that was focused before opening.
- `Escape` closes the palette from both window-level and input-level key handlers.

### Result navigation

- Arrow down/up moves highlighted row.
- Wrapping behavior:
  - Up from first goes to last.
  - Down from last goes to first.
- `Enter` selects highlighted row and navigates with `goto(...)`.
- Mouse hover updates highlighted row.
- Mouse click selects row.

### Loading behavior

- Query updates are debounced:
  - 150ms when query has text
  - 0ms for empty query (instant empty-state response)
- In-flight fetches are canceled via `AbortController` when a newer query is issued.

---

## 3) API contract and payloads

### Search endpoint

- Route: `GET /api/search`
- Query params:
  - `q` (search text; optional)
  - `season` (optional season slug/id context)
- Handler delegates to `getMegaSearchResponse(event, query)`.

### Recent-selection endpoint

- Route: `POST /api/search/recent`
- Requires authenticated user + active client.
- Request body includes:
  - `resultKey`, `category`, `title`, `subtitle`, `href`, `badge`, `meta`
- Body is validated with Zod in `src/routes/api/search/recent/+server.ts`.

---

## 4) Candidate sources searched

When query is non-empty, `getMegaSearchResponse(...)` builds candidates from:

1. **Public pages** (always)
  - `/`
  - `/log-in`
  - `/register`
  - `/offline`
2. **Dashboard pages** (authenticated only, permission-filtered)
  - Derived from `DASHBOARD_NAV_ITEMS`
  - Filtered with `filterDashboardNavigationItemsForPermissions(...)`
  - `href === '#'` entries are excluded
3. **Database entities** (authenticated + DB available)
  - Members
  - Scoped season (single season result only)
  - Offerings
  - Leagues
  - Divisions
  - Teams
  - Facilities
  - Facility areas

Inactive records are filtered out by category-specific `isActive` checks.

---

## 5) Season scoping behavior

Season scoping affects which offerings/leagues/divisions/teams are included.

### How scoped season is chosen

`resolveScopedSeason(...)` in order:

1. If `season` query param exists:
  - Match by season `id` or `slug` (case-insensitive trimmed normalization)
2. Otherwise fallback to:
  - Current season (`isCurrent === 1`)
  - Else active season (`isActive === 1`)
  - Else first available season
  - Else `null`

### How scoping is applied

- **Seasons category**: only the resolved scoped season is eligible.
- **Offerings**:
  - Include if `offering.seasonId === scopedSeason.id`, or
  - Any league under that offering matches scoped season via `leagueMatchesSeason(...)`.
- **Leagues**: include only if they match scoped season via `leagueMatchesSeason(...)`.
- **Divisions/Teams**:
  - Resolve parent league.
  - Include only when parent league matches scoped season.

If there is no scoped season (`null`), these filters become permissive.

---

## 6) Relevance scoring model (core priorities)

All scoring logic is in `src/lib/search/utils.ts` via `scoreMegaSearchCandidate(query, candidates)`.

For each result, the server passes these candidate fields:

- `title`
- `subtitle` (or empty)
- `meta` (or empty)

Scoring uses normalized text:

- Lowercased
- Non-alphanumeric collapsed to spaces (`[^a-z0-9]+`)
- Extra whitespace collapsed

It also compares compact forms with spaces removed to support punctuation/spacing differences.

### 6.1 Phrase-level bonuses (best match across candidate fields)

`scorePhraseValue(query, candidate)` yields:

- `400` if exact phrase match (normalized) or exact compact match
- `260` if candidate starts with query (normalized or compact)
- `180` if candidate contains query (normalized or compact)
- `0` otherwise

Only the **best phrase score across fields** is used.

### 6.2 Token-level scoring

The normalized query is tokenized by spaces.
For each token, best match across all candidate fields is added:

- `300` token equals full candidate (or compact-equal)
- `240` token equals any candidate token
- `220` token is prefix of full candidate (or compact prefix), token length > 1
- `200` token is prefix of any candidate token, token length > 1
- `140` token contained in candidate (or compact), token length > 1
- `0` otherwise

Single-character tokens are intentionally constrained to avoid noisy substring inflation.

### 6.3 Match bonuses and final formula

Let:

- `total` = sum of best per-token scores
- `matchedTokens` = number of query tokens with score > 0
- `queryTokens.length` = total token count
- `phraseBonus` = best phrase score from section 6.1

Final score:

`score = total + (matchedTokens * 90) + fullCoverageBonus + phraseBonus`

Where:

- `fullCoverageBonus = 180` if all tokens matched and query has >1 token
- otherwise `0`

If `matchedTokens === 0`, final score is `0` and the result is dropped.

### 6.4 Explicit category-level priority override

Teams receive a hard boost in `service.ts`:

- `teamScore = baseScore + 25`

Purpose: for team-name searches where team/division names overlap, teams are intentionally prioritized to favor direct team routes.

---

## 7) Sorting, grouping, and hard limits

After scoring:

1. Drop any `score <= 0`
2. Sort globally by:
  - Higher score first
  - Then title ascending (`localeCompare`, case-insensitive)
3. Group and cap using `groupMegaSearchResults(...)`:
  - `perCategoryLimit = 5`
  - `totalLimit = 25`

Important detail: groups are emitted in first-seen order from the sorted list.  
So category order in the UI is emergent from top-ranked hits, not a fixed category sequence.

---

## 8) Empty query behavior (zero-text state)

If `q` is empty/whitespace, server returns `getMegaSearchEmptyState(...)` instead of running ranked search.

Empty state contains:

1. **Recent** group (authenticated + DB + recents exist)
2. **Shortcuts** group (always present)

### Shortcuts behavior

Base shortcuts are:

- Dashboard
- Offerings
- Members
- Facilities

For authenticated users:

- Non-dashboard shortcuts are included only if user has permission to the target page (based on filtered dashboard page set).

For unauthenticated users:

- Only dashboard shortcut survives, and its `href` is rewritten to `/log-in`.

---

## 9) Recents lifecycle and retention policy

When user selects a result, client posts payload to `/api/search/recent`.

Server-side `storeMegaSearchRecentSelection(...)` behavior:

1. Find existing recent by `(userId, clientId, resultKey)`
2. If found:
  - `touch(...)` existing row (updates fields and recency timestamp)
3. If not found:
  - `create(...)` new row
4. Enforce max count:
  - `MAX_RECENT_COUNT = 10`
  - Fetch `MAX + 1`
  - Delete overflow rows beyond newest 10

Net effect:

- No duplicates for same result key per user/client.
- Re-selecting moves an item back to top.
- History is bounded.

---

## 10) Deep-link contracts per result type

Search results either navigate directly to a route or to a route+query-state combination.

Helper builders in `src/lib/search/utils.ts` define this contract:

- Members: `/dashboard/members?memberId=...&q=...`
- Facility areas: `/dashboard/facilities?facilityId=...&areaId=...`
- Teams: `/dashboard/offerings/{season}/{offering}/{league}/{division}/{team}`

Destination pages parse those params through `src/lib/search/page-state.ts`:

- `readMemberSearchSelection(url)` -> `{ memberId }`
- `readFacilitySearchSelection(url)` -> `{ facilityId, areaId }`
- `readLeagueSearchSelection(url)` -> `{ teamId }`

Those values are returned from page server loads and used by page UI logic to focus/expand/select the relevant record.

---

## 11) Authentication and permission effects

### Unauthenticated user

- Ranked query search:
  - Public pages only
  - No DB entity search
- Empty state:
  - No recents
  - Shortcut points to `/log-in`

### Authenticated user

- Ranked query search:
  - Public pages + permission-filtered dashboard pages + DB entities
- Empty state:
  - Recents (if any)
  - Permission-filtered shortcuts

This ensures useful public search without leaking restricted dashboard destinations/data.

---

## 12) Practical priority outcomes (what wins in real use)

Given current scoring + boosts:

1. Exact title hits are strongest.
2. Prefix matches beat generic contains matches.
3. Multi-token full coverage beats partial coverage.
4. Matches distributed across `title + subtitle + meta` can outrank single-field partials.
5. Teams edge out otherwise-similar results due to `+25` team boost.
6. Ties break by alphabetical title.

Because grouping happens after global sort, a very strong category can occupy multiple top slots up to the per-category cap.

---

## 13) Limits and tuning knobs

Current constants/knobs:

- Client debounce delay: `150ms` (non-empty query)
- Team boost: `+25`
- Per-category cap: `5`
- Total cap: `25`
- Max recents: `10`

If behavior needs tuning, these are the safest first levers before changing structural logic.

---

## 14) Test coverage that locks behavior

Key test files:

- `tests/shared/mega-search.test.ts`
  - exact vs prefix vs substring ordering
  - multi-field/token matching behavior
  - grouping caps
  - href builders
- `tests/search/search-route.test.ts`
  - public vs authenticated search behavior
  - permission filtering
  - inactive row filtering
  - team deep-link routing
  - team-over-division priority case
  - empty-state recents + shortcuts
- `tests/search/search-recents-route.test.ts`
  - auth requirement
  - create vs touch dedupe behavior
  - max-recents trimming
- `tests/shared/mega-search-page-state.test.ts`
  - destination query-state parsing

These tests are the best source of truth for expected user-visible behavior.

---

## 15) Quick troubleshooting map

If something appears wrong, check in this order:

1. **Result not appearing**
  - Is query non-empty?
  - Does candidate score > 0?
  - Is record active?
  - Is season scope excluding it?
  - Is it cut by per-category/total cap?
2. **Unexpected ordering**
  - Compare phrase score + token scores + coverage bonuses
  - Confirm team boost effects for team records
  - Check alphabetical tie-break
3. **Wrong destination state**
  - Verify href builder output
  - Verify destination page reads query params via `page-state.ts`
4. **Recents missing**
  - Must be authenticated with active client and DB
  - POST payload must pass route validation
  - Ensure selection is actually triggering `rememberSelection(...)`

