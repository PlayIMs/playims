---
name: playims-offerings-table-builder
description: Build or refactor the PlayIMs offerings board and related season offering list UI so it matches the canonical offerings route, including grouped offering articles, offerings-style league tables, summary counts, and concluded/historical section behavior.
---

# PlayIMs Offerings Table Builder

## Goal

Treat `src/routes/dashboard/offerings/+page.svelte` as the source of truth for any PlayIMs UI that needs to look or behave like the offerings board.

Use `$playims-data-table-builder` when the main task is the shared table chrome itself. Use `$playims-style-builder` when the surrounding page shell, section framing, search row, or wizard entry points also need to match the offerings page.

## Start Here

Read these files before editing:

- `src/routes/dashboard/offerings/+page.svelte`
- `src/lib/components/DataTable.svelte`
- `src/lib/components/data-table.ts`
- `src/lib/components/data-table/DataTableLinkedLabel.svelte`
- `src/lib/components/data-table/DataTableRowActions.svelte`
- `src/lib/components/SearchInput.svelte`
- `src/lib/components/ListboxDropdown.svelte`
- `src/lib/components/InfoPopover.svelte`
- `src/app.css`
- `references/offerings-table-patterns.md`

## Workflow

1. Ground the work in the live offerings route first.

- Confirm whether the task is copying the main offerings board, one offering article, a concluded-offerings section, or a related season list.
- Reuse the existing structure and naming from the offerings route before inventing new layout patterns.

2. Preserve the offerings page hierarchy.

- Use article-level sections for each offering when the UI represents one offering with its own counts, actions, and league rows.
- Keep summary copy, count badges, and historical/concluded framing outside the shared `DataTable` shell.

3. Use the shared table system for league rows.

- Keep league rows inside `DataTable` so headers, striping, and borders stay consistent.
- Prefer `DataTableLinkedLabel.svelte` for the identifying league cell and `DataTableRowActions.svelte` for the right-edge manage trigger.

4. Keep cross-cutting dashboard behaviors aligned.

- Use `SearchInput` for search/filter rows.
- Use `ListboxDropdown` for per-offering or page-level action menus.
- Use `InfoPopover` for explanatory copy that should persist on click.

5. Validate against the canonical offerings page.

- Compare spacing, border weight, header typography, badge tone, and action placement directly against `src/routes/dashboard/offerings/+page.svelte`.
- Preserve the split between active/current offerings and concluded or historical content unless the user explicitly requests a different information architecture.

## Progressive Disclosure Map

- `references/offerings-table-patterns.md`: canonical files, layout breakdown, and guardrails for offerings-specific board work

## Guardrails

- Do not replace offerings-style league tables with ad-hoc table markup when `DataTable` fits.
- Do not move per-offering summaries, badges, or section headers into the shared table component.
- Do not flatten grouped offering articles into one undifferentiated table unless the task explicitly calls for that change.
- Do not introduce new row-action patterns when the existing hover-only settings trigger fits.
- Do not swap offerings-style search, helper, or dropdown UI back to native controls.
- Do not treat concluded or historical offerings as a generic footer list; preserve the section framing from the canonical route when the same concept is present.

## Validation

- Run `pnpm check`.
- Manually compare the touched UI against `src/routes/dashboard/offerings/+page.svelte`.
- Manually verify row-action alignment, search/filter behavior, and mobile horizontal overflow for any touched offerings-style table.
