---
name: playims-search-bar-builder
description: Build or refactor PlayIMs search bars using `src/lib/components/SearchInput.svelte` so page searches, wizard list searches, compact panel searches, and embedded dropdown searches stay visually consistent with the offerings-page pattern. Use when adding a new free-text search field, replacing hand-rolled search markup, or extending search-bar behavior under `src/routes/dashboard/**` or shared components like `ListboxDropdown.svelte`.
---

# PlayIMs Search Bar Builder

## Goal

Use the shared `SearchInput` component as the source of truth for PlayIMs search UI. Keep the offerings page search bar as the default look: left magnifying-glass icon, placeholder text, square borders, and a trailing clear affordance that only appears when text exists.

## Start Here

Read these files before editing search UI:

- `src/lib/components/SearchInput.svelte`
- `src/routes/dashboard/offerings/+page.svelte`
- `src/routes/dashboard/members/+page.svelte`
- `src/routes/dashboard/facilities/+page.svelte`
- `src/routes/dashboard/offerings/_wizards/ManageSeasonWizard.svelte`
- `src/routes/dashboard/account/_wizards/ManageOrganizationWizard.svelte`
- `src/lib/components/ListboxDropdown.svelte` when searchable dropdown panels are involved
- `references/search-bar-recipes.md`

## Workflow

1. Audit the current search behavior before editing.
2. Reuse `SearchInput` instead of rebuilding icon/input/clear markup inline.
3. Match the offerings-page defaults unless the surrounding surface already uses a compact variant.
4. Use props and class hooks on `SearchInput` to tune width, height, icon sizing, placeholder copy, clear button style, and extra input attributes.
5. For searchable dropdown panels, route the internal search field through `SearchInput` too.
6. Preserve current behavior:
   - search scope and filtering rules
   - reset or pagination side effects
   - disabled/loading states
   - special attributes like `data-lpignore`
7. Run validation after migration.

## Required Rules

- Do not hand-roll new search bars with raw `<input>` plus ad-hoc icon and clear button markup.
- Do not introduce a second shared search component for ordinary text filtering.
- Keep the default search chrome square and border-led.
- Keep the clear affordance hidden until there is text to clear.
- Prefer semantically specific labels and placeholders over generic `Search`.
- Keep compact search bars visually related to the offerings pattern by shrinking the existing recipe instead of inventing a new one.
- If a search field needs custom focus or keyboard behavior, extend `SearchInput` rather than bypassing it.

## Validation

- Run `node_modules/.bin/prettier.cmd --write` on touched search-bar files.
- Run `node_modules/.bin/svelte-check.cmd --tsconfig ./tsconfig.json`.
- If `svelte-check` reports unrelated existing failures, note them explicitly.

Load `references/search-bar-recipes.md` when you need copyable prop recipes or compact-vs-default examples.
