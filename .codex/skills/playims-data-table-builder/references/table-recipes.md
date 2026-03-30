# Table Recipes

## Files to Read

- `src/lib/components/DataTable.svelte`
- `src/lib/components/data-table.ts`
- `src/lib/components/data-table/DataTableRowActions.svelte`
- `src/lib/components/data-table/DataTableLinkedLabel.svelte`
- `src/routes/dashboard/offerings/+page.svelte`
- `src/app.css` when badge/button classes or theme tokens matter

## Shared Component Contract

Use `DataTable` as the default starting point for dashboard tables that should look like the offerings page.

- `columns`: array of `DataTableColumn` objects
- Use `width` for column sizing
- Use typed alignment and padding props such as `headerTextAlignment`, `cellTextAlignment`, `cellVerticalAlignment`, `headerPaddingLeft`, and `cellPaddingRight`
- `rows`: array of row objects
- `caption`: optional screen-reader-only caption
- `rowId(row, rowIndex)`: optional row id hook
- `rowClass(row, rowIndex)`: optional extra row class hook for highlight/selection state
- `emptyBody`: optional snippet that renders placeholder or custom empty `<tr>` rows
- `cell`: required snippet that renders the content for each cell

The component already owns:

- outer border, white table surface, and horizontal overflow wrapper
- offerings-style header background and divider
- header typography: bold, uppercase, tight tracking, neutral text
- alternating neutral row striping
- row separators using neutral borders

## Default Recipes

### Offerings board proportions

Use these widths when the table mirrors the offerings board:

- first column: `24%`
- second column: `12%`
- third column: `22%`
- fourth column: `20%`
- fifth column: `22%`

### First column

- Mark the identifying column with `rowHeader: true`
- Keep the row title in `text-sm font-bold text-neutral-950 font-sans`
- Use the red primary square icon tile when the table is tied to an offering/sport row
- Prefer `DataTableLinkedLabel.svelte` when the cell includes both an icon tile and a clickable name
- Keep the hover underline and icon color shift scoped to the link itself, not the whole row

### Status column

- Use existing badge classes instead of inventing new chip styles
- Prefer `badge-primary` for open, `badge-primary-outlined` for waitlist/upcoming, and `badge-secondary-outlined` for closed
- Keep status labels uppercase with `text-xs uppercase tracking-wide`

### Offering-type title badges

- When an offering title needs a small companion badge like `LEAGUE` or `TOURNAMENT`, prefer a plain neutral border with neutral text.
- Do not default those title badges to `badge-secondary-outlined`; reserve secondary-outlined treatments for true secondary-status chips when the design calls for them.

### Date and schedule cells

- Use `text-xs leading-snug text-neutral-950 font-sans`
- Prefer `DateHoverText` for dashboard date/time displays so hover detail behavior stays consistent
- Use `align-top` on date-heavy columns

### Row action column

- Prefer `createDataTableRowActionColumn()` for the standard narrow right-side settings column
- Render the trigger with `DataTableRowActions.svelte`
- Let the trigger appear on row hover, but keep first-column link hover behavior scoped to the link
- If there is exactly one row action, the shared trigger should run it directly instead of opening a one-item dropdown

## Workflow

1. Read the offerings route before styling a new table.
2. Define `columns` first so widths, row-header semantics, and alignment are explicit.
3. Render cell content through the `cell` snippet instead of copying table chrome inline.
4. Use `emptyBody` when the design needs placeholder rows or a custom no-results row.
5. Keep route-specific behavior like sorting, links, hover tooltips, and action menus in the parent route.

## Guardrails

- Do not hand-roll new offerings-style table wrappers when `DataTable` fits.
- Do not change header typography, casing, or neutral header background for new matching tables.
- Do not switch offerings-style row dividers back to secondary-tinted borders unless the user explicitly asks for that accent.
- Do not replace badge classes with ad-hoc pills.
- Do not move row-specific business logic into the shared component.
- Do not make the component responsible for fetching, sorting, filtering, or pagination state.

## Validation

- Run `pnpm check` after changing the component or a consumer.
- Run `pnpm build` when changing the shared component or multiple table consumers.
