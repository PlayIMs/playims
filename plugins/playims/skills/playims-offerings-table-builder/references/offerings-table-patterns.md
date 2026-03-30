# Offerings Table Patterns

## Files To Read

- `src/routes/dashboard/offerings/+page.svelte`
- `src/lib/components/DataTable.svelte`
- `src/lib/components/data-table.ts`
- `src/lib/components/data-table/DataTableLinkedLabel.svelte`
- `src/lib/components/data-table/DataTableRowActions.svelte`
- `src/lib/components/SearchInput.svelte`
- `src/lib/components/ListboxDropdown.svelte`

## Canonical Structure

Use the offerings route when the UI needs these layers together:

- a season-scoped offerings page shell
- grouped offering articles with per-offering metadata
- a `DataTable` of league or group rows inside each article
- section-level summaries and counts outside the table
- a separate concluded or historical section when older offerings are shown

## Shared Recipes

- Keep per-offering sections separated with strong neutral dividers.
- Use the offerings page typography and badge recipes for counts and status indicators.
- Keep the table itself responsible only for row chrome; put offering summaries, headings, and helper copy around it.
- Prefer `DataTableLinkedLabel.svelte` for the first column when rows need the shared icon plus linked-label pattern.
- Prefer `createDataTableRowActionColumn()` and `DataTableRowActions.svelte` for compact row actions.
- Keep search/filter controls in the page or article header area, not inside the table header cells.

## Guardrails

- Do not collapse grouped offerings into a flat table unless the product change explicitly calls for it.
- Do not replace offerings-specific helper UI with one-off controls when shared dashboard components already exist.
- Do not restyle the table header, stripes, or borders away from the offerings route without a deliberate design change.
