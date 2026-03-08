---
name: playims-offerings-table-builder
description: Build or refactor PlayIMs dashboard tables using `src/lib/components/OfferingsTable.svelte` so new tables match the offerings page table chrome, header typography, uppercase casing, badge colors, striping, borders, and row-action behavior. Use when adding a new table, converting an ad-hoc list into a table, or restyling inconsistent tables under `src/routes/dashboard/**`.
---

# PlayIMs Offerings Table Builder

## Goal

Implement dashboard tables that look like the offerings page and route new table work through the shared `OfferingsTable` component whenever it fits.

Use `$playims-style-builder` alongside this skill when the surrounding page shell or action bars also need dashboard-aligned styling.

Use `$playims-listbox-dropdown-builder` for offerings-style row action menus and `$playims-wizard-builder` for multi-step row actions such as moving records between placements.

## Start Here

Read these files before editing:

- `src/lib/components/OfferingsTable.svelte`
- `src/lib/components/offerings-table.ts`
- `src/lib/components/ListboxDropdown.svelte` when the table needs row actions
- `src/routes/dashboard/offerings/+page.svelte`
- `src/app.css` when badge classes or theme tokens matter
- `references/table-recipes.md`

## Workflow

1. Confirm the table should match the offerings page visual language.

- Default to `OfferingsTable` for dashboard tables with fixed headers and row-based content.
- Keep route-specific sorting, filters, action menus, and data shaping in the parent route.

2. Define columns explicitly.

- Use `columns` to lock in header labels, widths, row-header semantics, and per-column alignment.
- Mark the identifying column with `rowHeader: true`.

3. Render row content with the `cell` snippet.

- Put links, badges, `DateHoverText`, tooltips, and action controls inside the snippet.
- Keep the shared component responsible only for the table shell and row chrome.

4. Use `emptyBody` only when the default empty row is not enough.

- Prefer `emptyBody` for offerings-style skeleton rows or custom placeholder rows.
- Keep custom empty markup as `<tr>` rows because it renders inside `<tbody>`.

5. Validate and compare against the offerings page.

- Check header tone, stripe contrast, border weight, and badge usage against the canonical offerings table.

6. Standardize row actions when the table needs per-row management.

- Do not render bulky inline controls inside the row by default.
- Prefer a narrow rightmost action column with a horizontal 3-dot trigger.
- Hide the trigger until row hover or keyboard focus by using row-level `group` styling and focus-visible fallbacks.
- Build the menu with `ListboxDropdown` in action mode, aligned right.
- Keep placeholder actions visible but disabled when the product wants to signal upcoming capability.
- Use modal flows for destructive or multi-field actions:
  - Use a confirm modal for delete/remove actions.
  - Use a shared wizard modal for move/reassignment flows.
- Keep row actions in the parent route so `OfferingsTable` remains a presentation shell.

## Progressive Disclosure Map

- `references/table-recipes.md`: component API, copyable width recipes, and guardrails

## Guardrails

- Do not rebuild offerings-style table wrappers inline if `OfferingsTable` can handle the job.
- Do not change header font treatment, uppercase casing, tracking, or neutral header background for matching tables.
- Do not push route-specific business logic into the shared component.
- Do not invent new status pill styles when existing badge classes fit.
- Do not replace `DateHoverText`, `HoverTooltip`, or shared action controls with ad-hoc alternatives when those behaviors are already needed.
- Do not place permanent inline selects, buttons, or destructive controls in the middle of offerings-style rows unless the table is explicitly designed for always-visible editing.
- Do not use vertical kebab, text links, or icon clusters for standard row actions when the hover-only horizontal 3-dot pattern fits.
- Do not wire move/delete row actions without the corresponding modal or wizard flow.

## Validation

- Run `pnpm check`.
- Run `pnpm build` when changing `OfferingsTable.svelte` or multiple consumers.
- Manually verify mobile overflow and desktop column balance for any touched table.
- Manually verify row-action visibility on mouse hover and keyboard focus, plus dropdown alignment near the right viewport edge.
