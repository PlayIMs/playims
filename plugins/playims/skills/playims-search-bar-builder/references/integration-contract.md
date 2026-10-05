# PlayIMs Search Bar Builder: integration details

Read this reference only for the relevant component variant or migration. The skill entrypoint and workspace AGENTS.md govern scope, testing, and completion; source inventories are selective lookup maps. Live APIs and shared CSS override outdated copied examples.

## Goal

Use the shared `SearchInput` component as the source of truth for PlayIMs search UI. Keep the offerings page search bar as the default look: left magnifying-glass icon, placeholder text, square borders, and a trailing clear affordance that only appears when text exists. `SearchInput` should be treated as the shared search primitive, with `app.css` handling the shared control styling.

## Start Here

Relevant source files (select those needed for this change):

- `src/lib/components/SearchInput.svelte`
- `src/routes/dashboard/offerings/+page.svelte`
- `src/routes/dashboard/members/+page.svelte`
- `src/routes/dashboard/facilities/+page.svelte`
- `src/routes/dashboard/offerings/_wizards/ManageSeasonWizard.svelte`
- `src/routes/dashboard/account/_wizards/ManageOrganizationWizard.svelte`
- `src/lib/components/ListboxDropdown.svelte` when searchable dropdown panels are involved
- `search-bar-recipes.md`

## Workflow

1. Audit the current search behavior before editing.
2. Reuse `SearchInput` instead of rebuilding icon/input/clear markup inline.
3. Match the offerings-page defaults unless the surrounding surface already uses a compact variant.
4. Use props and class hooks on `SearchInput` to tune width, height, icon sizing, placeholder copy, clear button style, and extra input attributes.
5. Prefer the component defaults first; only override classes when the surface truly needs a compact variant or a constrained width.
6. For searchable dropdown panels, route the internal search field through `SearchInput` too.
7. Preserve current behavior:
   - search scope and filtering rules
   - reset or pagination side effects
   - disabled/loading states
   - special attributes like `data-lpignore`
8. Run validation after migration.

## Required Rules

- Do not hand-roll new search bars with raw `<input>` plus ad-hoc icon and clear button markup.
- Do not introduce a second shared search component for ordinary text filtering.
- Keep the default search chrome square and border-led.
- Keep the clear affordance hidden until there is text to clear.
- Prefer semantically specific labels and placeholders over generic `Search`.
- Keep compact search bars visually related to the offerings pattern by shrinking the existing recipe instead of inventing a new one.
- Do not hand-roll local search icon/clear-button wrappers in route files when `SearchInput` already fits the use case.
- If a search field needs custom focus or keyboard behavior, extend `SearchInput` rather than bypassing it.

## Validation

Use the workspace AGENTS.md testing tier and the entrypoint completion criteria. Package validation applies when editing skills; app checks apply when editing the app.
