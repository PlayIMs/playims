---
name: playims-offerings-table-builder
description: Build grouped PlayIMs offerings boards and season lists with offering articles, league rows, summary counts, and historical sections. Use for board hierarchy rather than generic table chrome.
---

# PlayIMs Offerings Table Builder

Match grouped offerings-board structure to `src/routes/dashboard/offerings/+page.svelte`.

## Establish context

Follow workspace AGENTS.md and choose its testing tier before editing. Identify the active route, requested behavior, and current props/events. Infer these from code when possible; ask only for missing product decisions. Read The live offerings route and the affected board/season list; inspect shared tables or controls only when changed.

Current component APIs and app.css are authoritative. Preserve scope and existing contracts; load companion skills only for components/behavior being changed.

## Preserve these contracts

- Identify whether the task concerns the main board, one offering article, or concluded/history sections. Copy the matching live structure rather than flattening all rows into one table.
- Keep per-offering summaries, counts, badges, and historical framing outside DataTable. Use article-level sections when each offering has its own actions and league rows.
- Use DataTable for league rows, DataTableLinkedLabel for the identifying cell, and DataTableRowActions for management. The parent route owns filtering, grouping, counts, and handlers.
- Preserve the active/current versus concluded/historical split and existing status semantics unless the user requests a change.
- Reuse SearchInput, ListboxDropdown, and InfoPopover. Match spacing, borders, typography, badge tone, and action placement to the canonical route.
- Use the data-table skill for shared table behavior and the style skill for surrounding layout changes; do not load either for unrelated work.

## Read detail when needed

- [offerings table patterns](references/offerings-table-patterns.md): Board breakdown, section framing, and canonical recipes.
- [integration contract](references/integration-contract.md): Detailed board migration and parity rules.

## Done when

Grouping, counts, section framing, and row interactions match the intended live offerings pattern; verify affected filtering and narrow viewport behavior. Follow AGENTS.md for automated gates and test comments. Record actual checks and unverified browser behavior; a unit/parser pass does not establish a browser pass.
