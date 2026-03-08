# Table Recipes

## Files to Read

- `src/lib/components/OfferingsTable.svelte`
- `src/lib/components/offerings-table.ts`
- `src/routes/dashboard/offerings/+page.svelte`
- `src/app.css` when badge/button classes or theme tokens matter

## Shared Component Contract

Use `OfferingsTable` as the default starting point for dashboard tables that should look like the offerings page.

- `columns`: array of `{ key, label, widthClass?, headerClass?, cellClass?, rowHeader? }`
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
- row separators

## Default Recipes

### Offerings board proportions

Use these width classes when the table mirrors the offerings board:

- first column: `w-[24%]`
- second column: `w-[12%]`
- third column: `w-[22%]`
- fourth column: `w-[20%]`
- fifth column: `w-[22%]`

### First column

- Mark the identifying column with `rowHeader: true`
- Keep the row title in `text-sm font-bold text-neutral-950 font-sans`
- Use the red primary square icon tile when the table is tied to an offering/sport row

### Status column

- Use existing badge classes instead of inventing new chip styles
- Prefer `badge-primary` for open, `badge-primary-outlined` for waitlist/upcoming, and `badge-secondary-outlined` for closed
- Keep status labels uppercase with `text-xs uppercase tracking-wide`

### Date and schedule cells

- Use `text-xs leading-snug text-neutral-950 font-sans`
- Prefer `DateHoverText` for dashboard date/time displays so hover detail behavior stays consistent
- Use `align-top` on date-heavy columns

## Workflow

1. Read the offerings route before styling a new table.
2. Define `columns` first so widths, row-header semantics, and alignment are explicit.
3. Render cell content through the `cell` snippet instead of copying table chrome inline.
4. Use `emptyBody` when the design needs placeholder rows or a custom no-results row.
5. Keep route-specific behavior like sorting, links, hover tooltips, and action menus in the parent route.

## Guardrails

- Do not hand-roll new offerings-style table wrappers when `OfferingsTable` fits.
- Do not change header typography, casing, or neutral header background for new matching tables.
- Do not replace badge classes with ad-hoc pills.
- Do not move row-specific business logic into the shared component.
- Do not make the component responsible for fetching, sorting, filtering, or pagination state.

## Validation

- Run `pnpm check` after changing the component or a consumer.
- Run `pnpm build` when changing the shared component or multiple table consumers.
