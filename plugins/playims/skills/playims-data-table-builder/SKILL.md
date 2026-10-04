---
name: playims-data-table-builder
description: Build or migrate row-based PlayIMs dashboard tables with DataTable, shared linked labels, and row actions. Use for table chrome rather than grouped offerings-board structure.
---

# PlayIMs Data Table Builder

Render row-based dashboard tables with the offerings table's shared chrome.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read `src/lib/components/DataTable.svelte`, `data-table.ts`, and one matching live table. Inspect DataTableRowActions/DataTableLinkedLabel only when those features apply.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Define columns with explicit labels, alignment, and widths; mark the identifying column `rowHeader: true`. Render content through the `cell` snippet; custom `emptyBody` content must be table rows because it lives inside tbody.
- Keep sorting, filters, data shaping, mutations, and action handlers in the parent route. The shared table owns presentation and row chrome.
- Preserve uppercase header typography, neutral headers/dividers, stripe contrast, and existing badge classes. Use a neutral badge for compact offering types beside titles.
- For management columns use `createDataTableRowActionColumn()` and `DataTableRowActions`. Preserve hover/focus visibility and the direct action for a single option. Keep intentional placeholder actions disabled.
- Use confirmation modals for destructive actions and wizard flows for move/reassignment. Prefer DataTableLinkedLabel for icon/name links with hover scoped to the link, while settings triggers respond to row hover/focus.
- Preserve DateHoverText and shared hints. Use the offerings-board skill only when grouped offering hierarchy also changes.

## Read detail when needed

- [table recipes](references/table-recipes.md): Current table API, widths, and shared row-action recipes.
- [integration contract](references/integration-contract.md): Detailed table integration and parity rules.

## Done when

Columns, empty/loading rows, row actions, focus visibility, and viewport overflow are checked for the changed surface; repository test gates pass or limitations are reported. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
